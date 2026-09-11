import { randomBytes, createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { parseRole } from '../../domain/access.ts';
import type { Viewer } from '../../domain/model.ts';
import {measured} from '../performance.ts';

export interface Transactions {
  run<T>(viewer: Viewer | null, work: (client: PoolClient) => Promise<T>, readOnly?: boolean): Promise<T>;
}

export async function checkRole(client: PoolClient, expected: string, forbidden: string): Promise<number> {
  const result = await client.query(`SELECT pg_backend_pid() AS pid,
    session_user=current_user AND NOT r.rolsuper AND NOT r.rolbypassrls AND NOT r.rolcreaterole AND NOT r.rolcreatedb
    AND pg_has_role(current_user,$1,'MEMBER') AND NOT pg_has_role(current_user,$2,'MEMBER')
    AND NOT has_schema_privilege(current_user,'juyu','CREATE')
    AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='juyu' AND pg_has_role(current_user,c.relowner,'MEMBER')) AS safe
    FROM pg_roles r WHERE r.rolname=current_user`, [expected, forbidden]);
  if (result.rows[0]?.safe !== true) throw new Error('UNSAFE_DATABASE_ROLE: 运行账号权限过大或未配置');
  return result.rows[0].pid;
}

/** Server-only credentials. Viewer comes from the verified authentication adapter, never HTTP claims. */
export class ScopedDatabase implements Transactions {
  private runtime: Pool;
  private issuer: Pool;
  constructor(runtime: Pool, issuer: Pool) { this.runtime = runtime; this.issuer = issuer; }

  async run<T>(viewer: Viewer | null, work: (client: PoolClient) => Promise<T>, readOnly = false): Promise<T> {
    return measured('database.scope',()=>this.execute(viewer,work,readOnly));
  }
  private async execute<T>(viewer: Viewer | null, work: (client: PoolClient) => Promise<T>, readOnly: boolean): Promise<T> {
    if (!viewer || typeof viewer.id !== 'string' || !viewer.id.trim() || viewer.companyVerified !== true || !parseRole(viewer.role)) {
      throw new Error('FORBIDDEN: 未通过身份验证');
    }
    const client = await measured('database.pool',()=>this.runtime.connect());
    let issuer: PoolClient | undefined, transaction = false, hash: string | undefined, releaseError: Error | undefined;
    try {
      const pid = await checkRole(client, 'juyu_runtime', 'juyu_context_issuer');
      issuer = await measured('database.pool',()=>this.issuer.connect());
      await checkRole(issuer, 'juyu_context_issuer', 'juyu_runtime');
      const token = randomBytes(32).toString('hex');
      hash = createHash('sha256').update(token).digest('hex');
      // The context must exist before a repeatable-read transaction takes its first snapshot.
      await issuer.query("WITH expired AS (DELETE FROM juyu.request_contexts WHERE expires_at<clock_timestamp()) INSERT INTO juyu.request_contexts(token_hash,backend_pid,member_id,role,expires_at) VALUES ($1,$2,$3,$4,clock_timestamp()+interval '60 seconds')", [hash, pid, viewer.id, viewer.role]);
      await client.query(readOnly ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN');
      transaction = true;
      // Check the session pin and install transaction-local limits in the same round trip.
      // No business query runs until the backend PID has been verified.
      const context=await client.query(`SELECT pg_backend_pid() AS pid,
        set_config('lock_timeout','5s',true),
        set_config('statement_timeout','15s',true),
        set_config('idle_in_transaction_session_timeout','20s',true),
        set_config('juyu.token',$1,true)`, [token]);
      if(context.rows[0].pid!==pid)throw new Error('UNSUPPORTED_POOL_MODE: requires a direct or session-pooled connection');
      const value = await measured('database.work',()=>work(client));
      await client.query('COMMIT');
      transaction = false;
      return value;
    } catch (error) {
      if (transaction) {
        try { await client.query('ROLLBACK'); }
        catch { releaseError = new Error('ROLLBACK_FAILED'); }
      }
      throw error;
    } finally {
      client.release(releaseError);
      if (issuer) {
        try { if (hash) await issuer.query('DELETE FROM juyu.request_contexts WHERE token_hash=$1', [hash]); }
        catch {
          // COMMIT may already have succeeded. Expiry still closes access; do not report a false save failure.
          console.error('AUTH_CONTEXT_CLEANUP_FAILED');
        } finally { issuer.release(); }
      }
    }
  }
}
