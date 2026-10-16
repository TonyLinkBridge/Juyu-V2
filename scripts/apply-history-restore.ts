/** Explicit, pinned production function upgrade. Never changes business records. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {Pool,type PoolClient} from 'pg';

const env=parseEnv(await readFile('.env.local','utf8'));
const ref='zscxaqjqjoouiolkoxbi',previous='0058_discard_direct_publication',version='0059_restore_discarded_revision';
const directory=new URL('../src/server/database/migrations/',import.meta.url);
const migrationFiles=(await readdir(directory)).filter(file=>file.endsWith('.sql')).sort();
const knownFiles=migrationFiles.filter(file=>file.slice(0,-4)<=previous);
assert.equal(knownFiles.length,58,'UNEXPECTED_LOCAL_LEDGER');
const expected=await Promise.all(knownFiles.map(async file=>({version:file.slice(0,-4),checksum:createHash('sha256').update(await readFile(new URL(file,directory))).digest('hex')})));
const sql=await readFile(new URL(`${version}.sql`,directory),'utf8'),checksum=createHash('sha256').update(sql).digest('hex');
const target={version,checksum};

assert.equal(new URL(env.NEXT_PUBLIC_SUPABASE_URL??'https://invalid.local').hostname,`${ref}.supabase.co`);
assert.ok(env.JUYU_DATABASE_ADMIN_PASSWORD&&env.JUYU_DATABASE_CA_CERT,'MISSING_CONFIGURATION');
const pool=new Pool({host:'aws-0-ap-southeast-1.pooler.supabase.com',port:5432,user:`postgres.${ref}`,password:env.JUYU_DATABASE_ADMIN_PASSWORD,database:'postgres',ssl:{rejectUnauthorized:true,ca:env.JUYU_DATABASE_CA_CERT},max:1,connectionTimeoutMillis:10000,statement_timeout:30000});

async function ledger(client:PoolClient){return (await client.query<{version:string;checksum:string}>('SELECT version,checksum FROM juyu.schema_migrations ORDER BY version')).rows;}
function assertLedger(rows:{version:string;checksum:string}[]){
 const installed=rows.at(-1)?.version===version;
 assert.deepEqual(rows,installed?[...expected,target]:expected,'UNEXPECTED_SCHEMA');
 return installed;
}
async function counts(client:PoolClient){return (await client.query("SELECT (SELECT count(*)::int FROM juyu.documents) AS documents,(SELECT count(*)::int FROM juyu.revisions) AS revisions,(SELECT count(*)::int FROM juyu.audit_log) AS audits,(SELECT count(*)::int FROM juyu.reviews) AS reviews")).rows[0];}
async function businessSnapshot(client:PoolClient){
 const tables=(await client.query<{tablename:string}>("SELECT tablename FROM pg_tables WHERE schemaname='juyu' AND tablename<>'schema_migrations' ORDER BY tablename")).rows;
 const snapshot:Record<string,{count:number;digest:string}>={};
 for(const {tablename} of tables){
  const quoted=`"${tablename.replaceAll('"','""')}"`;
  snapshot[tablename]=(await client.query(`SELECT count(*)::int AS count,md5(COALESCE(string_agg(md5(row_to_json(t)::text),'' ORDER BY row_to_json(t)::text),'')) AS digest FROM juyu.${quoted} t`)).rows[0];
 }
 return snapshot;
}
async function verifyFunction(client:PoolClient){
 const row=(await client.query("SELECT p.prosecdef AS secured,p.proconfig AS config,has_function_privilege('juyu_runtime',p.oid,'EXECUTE') AS runtime,pg_get_functiondef(p.oid) AS definition FROM pg_proc p WHERE p.oid='juyu.restore_document_version(text,integer,integer)'::regprocedure")).rows[0];
 assert.equal(row.secured,true,'FUNCTION_SECURITY_INVALID');
 assert.equal(row.runtime,true,'FUNCTION_GRANT_INVALID');
 assert.ok(row.config.includes('search_path=pg_catalog, juyu'),'FUNCTION_SEARCH_PATH_INVALID');
 assert.ok(row.definition.includes("'discard_draft'"),'FUNCTION_DISCARD_GUARD_INVALID');
 assert.ok(row.definition.includes('max(r.revision_id)'),'FUNCTION_REVISION_ALLOCATION_INVALID');
}

const client=await pool.connect();
let phase='initial-check';
try{
 const installed=assertLedger(await ledger(client)),beforeCounts=await counts(client);
 console.log(JSON.stringify({project:ref,latest:installed?version:previous,pending:!installed,before:beforeCounts}));
 if(process.argv.includes('--apply')){
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
  try{
   phase='migration-lock';
   await client.query('SELECT pg_advisory_xact_lock(84620908)');
   phase='before-fingerprint';
   const alreadyInstalled=assertLedger(await ledger(client)),before=await businessSnapshot(client);
   phase='migration-apply';
   if(!alreadyInstalled){await client.query(sql);await client.query('INSERT INTO juyu.schema_migrations(version,checksum) VALUES($1,$2)',[version,checksum]);}
   phase='function-verification';
   assertLedger(await ledger(client));await verifyFunction(client);
   phase='after-fingerprint';
   const after=await businessSnapshot(client);assert.deepEqual(after,before);
   phase='commit';
   await client.query('COMMIT');
   console.log(JSON.stringify({applied:alreadyInstalled?[]:[version],verified:true,contentMutation:false,after:beforeCounts}));
  }catch(error){await client.query('ROLLBACK');throw error;}
 }
}catch(error){
 const code=typeof error==='object'&&error!==null&&'code' in error&&typeof error.code==='string'&&/^[A-Z0-9]{5}$/.test(error.code)?error.code:'UNKNOWN';
 console.error(error instanceof Error&&/^[A-Z_]+(?:: [a-z0-9_]+)?$/.test(error.message)?error.message:`HISTORY_RESTORE_MIGRATION_FAILED:${phase}:${code}`);process.exitCode=1;
}finally{client.release();await pool.end();}
