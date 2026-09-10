/** Explicit operator drill for the two projects approved for T060. Never invoked by the app. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm,chmod,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseEnv,promisify} from 'node:util';
import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {Pool} from 'pg';
import type {PoolClient} from 'pg';

const sourceRef='zscxaqjqjoouiolkoxbi', targetRef='bgrvonvrytlaufityutq';
const env=parseEnv(await readFile('.env.local','utf8'));
assert.ok(env.NEXT_PUBLIC_SUPABASE_URL && env.JUYU_DATABASE_CA_CERT,'MISSING_SOURCE_CONFIG');
assert.ok(env.JUYU_DATABASE_ADMIN_PASSWORD && env.JUYU_RECOVERY_DATABASE_PASSWORD,'MISSING_DATABASE_PASSWORD');
assert.equal(new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname,sourceRef+'.supabase.co');
const sourceHost='aws-0-ap-southeast-1.pooler.supabase.com',targetHost='aws-0-ap-northeast-1.pooler.supabase.com';
const options=(host:string,ref:string,password:string)=>({host,port:5432,user:'postgres.'+ref,password,database:'postgres',ssl:{rejectUnauthorized:true,ca:env.JUYU_DATABASE_CA_CERT},max:2,connectionTimeoutMillis:10000});
const source=new Pool(options(sourceHost,sourceRef,env.JUYU_DATABASE_ADMIN_PASSWORD));
const target=new Pool(options(targetHost,targetRef,env.JUYU_RECOVERY_DATABASE_PASSWORD));
const work=await mkdtemp(join(tmpdir(),'juyu-t060-cloud-'));
const sha=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
const quote=(value:string)=>'"'+value.replaceAll('"','""')+'"';
const run=promisify(execFile);
async function command(name:string,host:string,ref:string,password:string,args:string[]){
 try {await run(join(process.env.JUYU_PG_BIN||'/opt/homebrew/opt/libpq/bin',name),args,{timeout:120000,env:{PATH:process.env.PATH,NODE_ENV:'test',PGHOST:host,PGPORT:'5432',PGDATABASE:'postgres',PGUSER:'postgres.'+ref,PGPASSWORD:password,PGSSLMODE:'verify-full',PGSSLROOTCERT:join(work,'ca.pem'),PGCONNECT_TIMEOUT:'10'}});}
 catch(error){const stderr=String((error as {stderr?:string}).stderr??''); const safe=stderr.split('\n').filter(line=>/ERROR:/.test(line)).map(line=>line.replace(/password.*$/i,'[redacted]').slice(0,240));throw new Error(name+' failed: '+(safe.join('; ')||'check connectivity or client compatibility'));}
}
async function snapshot(client:PoolClient){
 await client.query("SET TIME ZONE 'UTC'");
 const names=(await client.query<{tablename:string}>("SELECT tablename FROM pg_tables WHERE schemaname='juyu' AND tablename<>'request_contexts' ORDER BY tablename")).rows.map(r=>r.tablename);
 const result:Record<string,{count:number;sha256:string}>={};
 for(const name of names){const rows=(await client.query<{value:string}>(`SELECT row_to_json(t)::text value FROM juyu.${quote(name)} t ORDER BY row_to_json(t)::text COLLATE "C"`)).rows;result[name]={count:rows.length,sha256:sha(JSON.stringify(rows))};}
 return result;
}
let sourceClient:PoolClient|undefined,targetClient:PoolClient|undefined;
try {
 await writeFile(join(work,'ca.pem'),env.JUYU_DATABASE_CA_CERT,{mode:0o600});
 sourceClient=await source.connect(); targetClient=await target.connect();
 assert.equal((await targetClient.query("SELECT to_regnamespace('juyu') AS schema")).rows[0].schema,null,'TARGET_NOT_EMPTY: refusing overwrite');
 await sourceClient.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
 await sourceClient.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'");
 const tables=(await sourceClient.query<{tablename:string}>("SELECT tablename FROM pg_tables WHERE schemaname='juyu' AND tablename<>'request_contexts' ORDER BY tablename")).rows;
 // A short SHARE lock freezes content while the snapshot is exported. No production data is written.
 await sourceClient.query('LOCK TABLE '+tables.map(r=>'juyu.'+quote(r.tablename)).join(',')+' IN SHARE MODE');
 assert.equal((await sourceClient.query('SELECT count(*)::int n FROM juyu.assets')).rows[0].n,0,'SOURCE_HAS_MEDIA: pair database with media before proceeding');
 const before=await snapshot(sourceClient);
 const sequences=(await sourceClient.query("SELECT sequencename,last_value FROM pg_sequences WHERE schemaname='juyu' ORDER BY sequencename")).rows;
 const migrations=(await sourceClient.query<{version:string;checksum:string}>('SELECT version,checksum FROM juyu.schema_migrations ORDER BY version')).rows;
 await mkdir(join(work,'migrations'),{mode:0o700});
 for(const m of migrations){assert.match(m.version,/^\d{4}_[a-z_]+$/);const sql=await readFile(new URL('../src/server/database/migrations/'+m.version+'.sql',import.meta.url));assert.equal(sha(sql),m.checksum,'MIGRATION_DRIFT');await writeFile(join(work,'migrations',m.version+'.sql'),sql,{mode:0o600});}
 const snapshotId=(await sourceClient.query('SELECT pg_export_snapshot() id')).rows[0].id;
 const archive=join(work,'database.dump');
 await command('pg_dump',sourceHost,sourceRef,env.JUYU_DATABASE_ADMIN_PASSWORD,['--format=custom','--schema=juyu','--exclude-table-data=juyu.request_contexts','--snapshot='+snapshotId,'--file='+archive]);
 await chmod(archive,0o600);
 const archiveSha256=sha(await readFile(archive));
 await sourceClient.query('COMMIT'); // Release the content freeze before cloud restoration.
 console.log(JSON.stringify({stage:'source_snapshot_complete',tables:Object.keys(before).length,migrations:migrations.length,media:0}));
 await targetClient.query(`DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='juyu_runtime') THEN CREATE ROLE juyu_runtime NOLOGIN NOBYPASSRLS; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='juyu_context_issuer') THEN CREATE ROLE juyu_context_issuer NOLOGIN NOBYPASSRLS; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('juyu_runtime','juyu_context_issuer') AND (rolsuper OR rolbypassrls OR rolcanlogin)) THEN RAISE EXCEPTION 'UNSAFE_TARGET_ROLE'; END IF;
 END $$`);
 assert.equal(sha(await readFile(archive)),archiveSha256);
 const started=Date.now();
 await command('pg_restore',targetHost,targetRef,env.JUYU_RECOVERY_DATABASE_PASSWORD,['--exit-on-error','--single-transaction','--no-owner','--dbname=postgres',archive]);
 assert.deepEqual(await snapshot(targetClient),before,'RESTORED_TABLE_MISMATCH');
 assert.deepEqual((await targetClient.query("SELECT sequencename,last_value FROM pg_sequences WHERE schemaname='juyu' ORDER BY sequencename")).rows,sequences);
 assert.equal((await targetClient.query('SELECT count(*)::int n FROM juyu.request_contexts')).rows[0].n,0);
 const policies=(await targetClient.query("SELECT count(*)::int n FROM pg_policies WHERE schemaname='juyu'")).rows[0].n;
 const sourcePolicies=(await sourceClient.query("SELECT count(*)::int n FROM pg_policies WHERE schemaname='juyu'")).rows[0].n;
 assert.equal(policies,sourcePolicies);
 const report={createdAt:new Date().toISOString(),source:sourceRef,target:targetRef,archiveSha256,tables:before,migrations,policies,media:0,restoreAndCompareMs:Date.now()-started,scope:'Real Supabase database restore; media and deployed identity acceptance separate',retention:'Temporary unencrypted drill archive deleted after verification; not an offsite backup'};
 await mkdir('output/verification',{recursive:true});
 await writeFile('output/verification/t060-cloud-database.json',JSON.stringify(report,null,2),{mode:0o600});
 console.log(JSON.stringify({stage:'cloud_database_restored',tables:Object.keys(before).length,documents:before.documents.count,migrations:migrations.length,policies,restoreAndCompareMs:report.restoreAndCompareMs,report:'output/verification/t060-cloud-database.json'}));
} catch(error){if(sourceClient)await sourceClient.query('ROLLBACK').catch(()=>{});console.error(error instanceof Error?error.message:'RECOVERY_FAILED');process.exitCode=1;}
finally {sourceClient?.release();targetClient?.release();await source.end();await target.end();await rm(work,{recursive:true,force:true});}
