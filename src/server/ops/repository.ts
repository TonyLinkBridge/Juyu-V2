import type {PoolClient} from 'pg';
import type {OpsItem,OpsPage,ReaderSections} from '../../ops/model.ts';
import {positiveInteger} from '../../feedback/model.ts';

export async function readReaderSections(client:PoolClient):Promise<ReaderSections>{
 const identity=(await client.query<{role:string}>(`SELECT i.role FROM juyu.current_identity() i
  JOIN juyu.members m ON m.clerk_user_id=i.member_id
  WHERE m.verified_email IS NOT NULL AND m.observed_at IS NOT NULL`)).rows[0];
 if(!identity)throw new Error('FORBIDDEN');
 return {ops:identity.role==='ops'||identity.role==='admin'};
}

export async function readFirstOpsId(client:PoolClient):Promise<string|null>{
 if(!(await readReaderSections(client)).ops)throw new Error('FORBIDDEN');
 const row=(await client.query<{id:string}>('SELECT id FROM juyu.read_ops_publications() ORDER BY title COLLATE "C",id COLLATE "C" LIMIT 1')).rows[0];
 return row?.id??null;
}

export async function readOps(client:PoolClient,page=1):Promise<OpsPage>{
 positiveInteger(page);
 if(!(await readReaderSections(client)).ops)throw new Error('FORBIDDEN');

 // Both queries share the enclosing repeatable-read snapshot. SQL projects only
 // current allowed OPS publications without opening raw document access.
 const total=(await client.query<{n:number}>('SELECT count(*)::int AS n FROM juyu.read_ops_publications()')).rows[0].n;
 const pages=Math.max(1,Math.ceil(total/30));page=Math.min(page,pages);
 const items=(await client.query<OpsItem>('SELECT id,title,revision,tags FROM juyu.read_ops_publications() ORDER BY title COLLATE "C",id COLLATE "C" LIMIT 30 OFFSET $1',[(page-1)*30])).rows;

 return {items,total,page,pages};
}