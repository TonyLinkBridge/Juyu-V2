import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, writeFile, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import type { Pool } from 'pg';
import { temporaryDatabase, ownerTransactions } from '../database/fixture.ts';
import { storageFixture } from '../storage/http-fixture.ts';
import { migrate } from '../../src/server/database/migrate.ts';
import { DocumentRepository } from '../../src/server/database/repository.ts';
import { ScopedDatabase } from '../../src/server/database/scoped.ts';
import { AuthorizationService } from '../../src/server/authorization/service.ts';
import { SupabasePrivateStorage } from '../../src/server/storage/supabase.ts';
import { backupFiles, restoreFiles } from '../../src/server/storage/backup.ts';
import type { Viewer } from '../../src/domain/model.ts';

const execute = promisify(execFile);
const digest = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
// This drill deliberately never reads .env or accepts database connection arguments.
async function pgTool(name: string, pool: Pool, args: string[]) {
  const p = pool.options;
  assert.equal(p.host, '127.0.0.1');
  const binary = process.env.JUYU_PG_BIN ? join(process.env.JUYU_PG_BIN, name) : name;
  try {
    await execute(binary, args, { env: {
      PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'test',
      PGHOST: '127.0.0.1', PGPORT: String(p.port), PGUSER: 'postgres',
      PGDATABASE: 'postgres', PGPASSWORD: String(p.password), PGCONNECT_TIMEOUT: '5',
    }});
  } catch { throw new Error(`${name} failed in isolated recovery drill; check installed PostgreSQL client version`); }
}
async function snapshot(pool: Pool) {
  const tables = (await pool.query<{tablename:string}>("SELECT tablename FROM pg_tables WHERE schemaname='juyu' AND tablename<>'request_contexts' ORDER BY tablename")).rows;
  const output: Record<string, {count:number; sha256:string}> = {};
  for (const {tablename} of tables) {
    const quoted = '"' + tablename.replaceAll('"', '""') + '"';
    const rows = (await pool.query<{value:string}>(`SELECT row_to_json(t)::text AS value FROM juyu.${quoted} t ORDER BY row_to_json(t)::text COLLATE "C"`)).rows;
    output[tablename] = {count: rows.length, sha256:digest(JSON.stringify(rows))};
  }
  return output;
}

test('paired database, migrations and private media recover into isolated empty targets', {timeout:180_000}, async t => {
  const backup = await mkdtemp(join(tmpdir(), 'juyu-recovery-'));
  t.after(() => rm(backup, {recursive:true, force:true}));
  const source = await temporaryDatabase(); t.after(() => source.close());
  const target = await temporaryDatabase(); t.after(() => target.close());
  const sourceFiles = await storageFixture(); t.after(() => sourceFiles.close());
  const targetFiles = await storageFixture(); t.after(() => targetFiles.close());
  const sourceStore = new SupabasePrivateStorage(sourceFiles.url, 'test-only-key', {allowLoopback:true});
  const targetStore = new SupabasePrivateStorage(targetFiles.url, 'test-only-key', {allowLoopback:true});
  await migrate(source.pool);
  await source.pool.query("INSERT INTO juyu.members(clerk_user_id,display_name,observed_role) VALUES ('a','A','admin'),('b','B','admin'),('support','Support','support'),('ops','Ops','ops')");
  await source.pool.query("UPDATE juyu.members SET verified_email=clerk_user_id||'@example.test',observed_at=now()");
  const a:Viewer = {id:'a',role:'admin',companyVerified:true}, b:Viewer = {...a,id:'b'};
  const repo = new DocumentRepository(ownerTransactions(source.pool));
  for (const kind of ['article','ops'] as const) {
    let doc = await repo.create({id:kind,kind,title:kind,body:'Published recovery sample',audience:kind==='ops'?'ops':'staff'}, a);
    for (const type of ['submit','approve','queue','publish'] as const)
      doc = await repo.execute(kind,{type},type==='approve'?b:a,{expectedSequence:doc.sequence,reviewer:b});
    if (kind==='article') {
      doc = await repo.execute(kind,{type:'edit',title:'Pending revision',body:'Private future revision',audience:'staff'},a,{expectedSequence:doc.sequence});
      await repo.execute(kind,{type:'submit'},a,{expectedSequence:doc.sequence,reviewer:b});
    }
  }
  await repo.create({id:'draft',kind:'article',title:'Private draft',body:'Not published',audience:'staff'},a);
  const bytes = Buffer.from('T060 private attachment recovery sample');
  const asset = {id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',document_id:'article',filename:'sample.txt',mime_type:'text/plain',byte_size:bytes.length,bucket:'juyu-private',object_key:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'};
  await sourceStore.put(asset.object_key, new Blob([bytes]).stream(), asset.mime_type);
  await source.pool.query("INSERT INTO juyu.assets(id,document_id,uploaded_by,filename,mime_type,byte_size,object_key,status) VALUES($1::uuid,'article','a',$2,$3,$4,$1::text,'ready')",[asset.id,asset.filename,asset.mime_type,asset.byte_size]);
  await source.pool.query("INSERT INTO juyu.revision_assets(document_id,revision_id,asset_id,usage) SELECT id,published_revision_id,$1::uuid,'attachment' FROM juyu.documents WHERE id='article'",[asset.id]);
  await source.pool.query("INSERT INTO juyu.request_contexts(token_hash,backend_pid,member_id,role,expires_at) VALUES(repeat('a',64),pg_backend_pid(),'a','admin',clock_timestamp()+interval '60 seconds')");
  const baseline = await snapshot(source.pool);
  await mkdir(join(backup,'migrations'), {mode:0o700});
  const migrations = (await source.pool.query<{version:string;checksum:string}>('SELECT version,checksum FROM juyu.schema_migrations ORDER BY version')).rows;
  for (const migration of migrations) {
    const sql = await readFile(new URL(`../../src/server/database/migrations/${migration.version}.sql`,import.meta.url));
    assert.equal(digest(sql), migration.checksum);
    await writeFile(join(backup,'migrations',migration.version+'.sql'),sql,{mode:0o600,flag:'wx'});
  }
  const archive = join(backup,'database.dump');
  await pgTool('pg_dump',source.pool,['--format=custom','--schema=juyu','--exclude-table-data=juyu.request_contexts','--file',archive]);
  await chmod(archive,0o600);
  const archiveHash = digest(await readFile(archive));
  await backupFiles(sourceStore,[asset],join(backup,'media'));
  await writeFile(join(backup,'manifest.json'),JSON.stringify({scope:'isolated-fixture',archiveHash,migrations,baseline}),{mode:0o600,flag:'wx'});
  // Bootstrap global capability roles. Drop only our internally created disposable target schema.
  await migrate(target.pool);
  await target.pool.query('DROP SCHEMA juyu CASCADE');
  assert.equal(digest(await readFile(archive)),archiveHash);
  await pgTool('pg_restore',target.pool,['--exit-on-error','--single-transaction','--dbname=postgres',archive]);
  assert.deepEqual(await snapshot(target.pool),baseline);
  assert.deepEqual((await target.pool.query("SELECT sequencename,last_value FROM pg_sequences WHERE schemaname='juyu' ORDER BY sequencename")).rows,(await source.pool.query("SELECT sequencename,last_value FROM pg_sequences WHERE schemaname='juyu' ORDER BY sequencename")).rows);
  assert.deepEqual(await migrate(target.pool),[]);
  // Simulate a failed transactional schema change without touching external databases.
  const migrationClient = await target.pool.connect();
  try {
    await migrationClient.query('BEGIN');
    await migrationClient.query('CREATE TABLE juyu.recovery_probe(id integer)');
    await assert.rejects(migrationClient.query('SELECT 1/0'));
    await migrationClient.query('ROLLBACK');
  } finally {migrationClient.release();}
  assert.equal((await target.pool.query("SELECT to_regclass('juyu.recovery_probe') AS probe")).rows[0].probe,null);
  assert.deepEqual(await snapshot(target.pool),baseline);
  assert.equal((await target.pool.query('SELECT count(*)::int AS n FROM juyu.request_contexts')).rows[0].n,0);
  await restoreFiles(targetStore,join(backup,'media'));
  assert.deepEqual(Buffer.from(await (await targetStore.read(asset.object_key)).arrayBuffer()),bytes);
  assert.equal((await fetch(`${targetFiles.url}/storage/v1/object/juyu-private/${asset.id}`)).status,401);
  const runtimePassword = randomBytes(24).toString('hex'), issuerPassword = randomBytes(24).toString('hex');
  await target.pool.query(`CREATE ROLE recovery_runtime LOGIN PASSWORD '${runtimePassword}' IN ROLE juyu_runtime`);
  await target.pool.query(`CREATE ROLE recovery_issuer LOGIN PASSWORD '${issuerPassword}' IN ROLE juyu_context_issuer`);
  const runtime = target.connectAs('recovery_runtime',runtimePassword), issuer = target.connectAs('recovery_issuer',issuerPassword);
  try {
    const db = new ScopedDatabase(runtime,issuer);
    const support = new AuthorizationService(db,async()=>({id:'support',role:'support',companyVerified:true}));
    const ops = new AuthorizationService(db,async()=>({id:'ops',role:'ops',companyVerified:true}));
    assert.equal(await db.run({id:'support',role:'support',companyVerified:true},async c=>(await c.query('SELECT juyu.can_read_asset($1) AS allowed',[asset.id])).rows[0].allowed,true),true);
    const home = await support.home();
    assert.deepEqual(home.latest.map(d=>d.id),['article']);
    assert.equal(home.latest[0].title,'article');
    assert.deepEqual((await ops.home()).latest.map(d=>d.id).sort(),['article','ops']);
    await assert.rejects(new AuthorizationService(db,async()=>null).home(),/FORBIDDEN/);
  } finally {await runtime.end();await issuer.end();}
  const emptyFiles = await storageFixture(); t.after(() => emptyFiles.close());
  const emptyStore = new SupabasePrivateStorage(emptyFiles.url,'test-only-key',{allowLoopback:true});
  await writeFile(join(backup,'media',asset.id),'corrupted');
  await assert.rejects(restoreFiles(emptyStore,join(backup,'media')),/BACKUP_INTEGRITY/);
  await assert.rejects(emptyStore.read(asset.object_key),/PRIVATE_OBJECT_UNAVAILABLE/);
  t.diagnostic(JSON.stringify({scope:'local PostgreSQL + simulated Storage',tables:Object.keys(baseline).length,migrations:migrations.length,documents:baseline.documents.count,media:1,archiveSha256:archiveHash,checks:['all table contents','sequences','migration checksums','failed schema transaction rollback','restricted roles','published version retained','private bytes','corrupt media refused']}));
});
