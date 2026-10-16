/** Explicit, pinned production function upgrade. Never discards an article. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {Pool} from 'pg';
import {migrate} from '../src/server/database/migrate.ts';
const env=parseEnv(await readFile('.env.local','utf8'));
const ref='zscxaqjqjoouiolkoxbi',version='0058_discard_direct_publication';
assert.equal(new URL(env.NEXT_PUBLIC_SUPABASE_URL??'https://invalid.local').hostname,`${ref}.supabase.co`);
assert.ok(env.JUYU_DATABASE_ADMIN_PASSWORD&&env.JUYU_DATABASE_CA_CERT,'MISSING_CONFIGURATION');
const pool=new Pool({host:'aws-0-ap-southeast-1.pooler.supabase.com',port:5432,user:`postgres.${ref}`,password:env.JUYU_DATABASE_ADMIN_PASSWORD,database:'postgres',ssl:{rejectUnauthorized:true,ca:env.JUYU_DATABASE_CA_CERT},max:1,connectionTimeoutMillis:10000,statement_timeout:20000});
try{
 const versions=(await pool.query<{version:string}>('SELECT version FROM juyu.schema_migrations ORDER BY version')).rows.map(row=>row.version);
 assert.ok(['0057_reader_navigation',version].includes(versions.at(-1)??''),'UNEXPECTED_SCHEMA');
 console.log(JSON.stringify({project:ref,latest:versions.at(-1),pending:!versions.includes(version)}));
 if(process.argv.includes('--apply')){
  const applied=await migrate(pool,{through:version});
  assert.ok(applied.length===0||(applied.length===1&&applied[0]===version),'UNEXPECTED_MIGRATION');
  const row=(await pool.query("SELECT p.prosecdef AS secured,p.proconfig AS config,has_function_privilege('juyu_runtime',p.oid,'EXECUTE') AS runtime,pg_get_functiondef(p.oid) AS definition FROM pg_proc p WHERE p.oid='juyu.discard_working_draft(text,integer)'::regprocedure")).rows[0];
  assert.equal(row.secured,true);assert.equal(row.runtime,true);assert.ok(row.config.includes('search_path=pg_catalog, juyu'));assert.ok(row.definition.includes("IF publication.action='direct_publish'"));
  const guard=(await pool.query("SELECT count(*)::int AS n FROM pg_trigger WHERE tgrelid='juyu.audit_log'::regclass AND tgname='validate_direct_publication_evidence' AND tgenabled='O' AND NOT tgisinternal")).rows[0];
  assert.equal(guard.n,1);
  console.log(JSON.stringify({applied,verified:true,contentMutation:false}));
 }
}catch(error){console.error(error instanceof Error&&/^[A-Z_]+(?:: [a-z0-9_]+)?$/.test(error.message)?error.message:'DRAFT_DISCARD_MIGRATION_FAILED');process.exitCode=1;}finally{await pool.end();}
