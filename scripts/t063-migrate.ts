/** Explicit operator command for the approved JUYU production migration. No startup invocation. */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {migrate} from '../src/server/database/migrate.ts';
const env=parseEnv(await readFile('.env.local','utf8'));
const ref='zscxaqjqjoouiolkoxbi';
const origin=env.NEXT_PUBLIC_SUPABASE_URL;
assert.ok(origin,'MISSING_CONFIGURATION');
assert.equal(new URL(origin).hostname,ref+'.supabase.co');
assert.ok(env.JUYU_DATABASE_ADMIN_PASSWORD&&env.JUYU_DATABASE_CA_CERT,'MISSING_CONFIGURATION');
const pool=new Pool({host:'aws-0-ap-southeast-1.pooler.supabase.com',port:5432,user:'postgres.'+ref,password:env.JUYU_DATABASE_ADMIN_PASSWORD,database:'postgres',ssl:{rejectUnauthorized:true,ca:env.JUYU_DATABASE_CA_CERT},max:1,connectionTimeoutMillis:10000,statement_timeout:20000});
try{
 const versions=(await pool.query('SELECT version FROM juyu.schema_migrations ORDER BY version')).rows.map(r=>r.version);
 assert.ok(versions.at(-1)==='0028_qa_search'||versions.at(-1)==='0029_shared_revision_config_locks','UNEXPECTED_SCHEMA');
 console.log(JSON.stringify({project:ref,migrations:versions.length,latest:versions.at(-1),pending:versions.at(-1)==='0028_qa_search'}));
 if(process.argv.includes('--apply')){
  const before=(await pool.query("SELECT pg_get_functiondef('juyu.guard_revision_categories()'::regprocedure) AS categories,pg_get_functiondef('juyu.guard_revision_fields()'::regprocedure) AS fields")).rows[0];
  await mkdir('output/verification',{recursive:true});await writeFile('output/verification/t063-before-config-locks.json',JSON.stringify(before),{mode:0o600,flag:'wx'}).catch(e=>{if(e.code!=='EEXIST')throw e;});
  const applied=await migrate(pool);assert.ok(applied.length===0||(applied.length===1&&applied[0]==='0029_shared_revision_config_locks'));
  const verified=(await pool.query("SELECT pg_get_functiondef('juyu.guard_revision_categories()'::regprocedure) LIKE '%pg_advisory_xact_lock_shared(84620949)%' AS categories, pg_get_functiondef('juyu.guard_revision_fields()'::regprocedure) LIKE '%pg_advisory_xact_lock_shared(84620948)%' AS fields")).rows[0];assert.ok(verified.categories&&verified.fields);
  console.log(JSON.stringify({applied,verified}));
 }
}catch(error){console.error(JSON.stringify({error:error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'MIGRATION_CHECK_FAILED'}));process.exitCode=1;}finally{await pool.end();}
