import {createDocument} from '../../src/domain/workflow.ts';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { Pool } from 'pg';
import { temporaryDatabase, ownerTransactions } from './fixture.ts';
import { migrate } from '../../src/server/database/migrate.ts';
import { DocumentRepository } from '../../src/server/database/repository.ts';

const supportingTables = ['categories', 'revision_categories', 'assets', 'revision_assets', 'favorites', 'recent_views', 'feedback', 'search_queries', 'search_results', 'analytics_events', 'settings', 'setting_versions', 'notifications', 'notification_receipts'];
const actor = { id: 'admin', role: 'admin' as const, companyVerified: true };
let fixture: Awaited<ReturnType<typeof temporaryDatabase>>;
let pool: Pool;
let repository: DocumentRepository;

before(async () => {
  fixture = await temporaryDatabase();
  pool = fixture.pool;
  await migrate(pool);
  await pool.query("INSERT INTO juyu.members(clerk_user_id,display_name) VALUES ('admin','Admin'),('staff-a','A'),('staff-b','B')");
  repository = new DocumentRepository(ownerTransactions(pool));
});
after(async () => { if (fixture) await fixture.close(); });
const draft = () => repository.create({ id: randomUUID(), title: '资料', body: '正文', kind: 'article', audience: 'staff' }, actor);
const foreignKey = { code: '23503' };
const duplicate = { code: '23505' };
const invalid = { code: '23514' };

async function setting() {
  const id = randomUUID();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("INSERT INTO juyu.settings(id,key,kind,current_version) VALUES ($1,$2,'feature_flag',1)", [id, `flag-${id}`]);
    await client.query("INSERT INTO juyu.setting_versions(setting_id,version,config,changed_by) VALUES ($1,1,'{\"enabled\":false}','admin')", [id]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
  return id;
}

async function seedSupportingData() {
  // Every integrity/RLS test can run alone; do not depend on previous tests to seed tables.
  const document = await draft();
  const category = randomUUID(), asset = randomUUID(), search = randomUUID(), notification = randomUUID();
  const feature = await setting();
  await pool.query("INSERT INTO juyu.categories(id,name) VALUES ($1,'测试分类')", [category]);
  await pool.query('INSERT INTO juyu.revision_categories(document_id,revision_id,category_id) VALUES ($1,1,$2)', [document.id, category]);
  await pool.query("INSERT INTO juyu.assets(id,document_id,uploaded_by,filename,mime_type,byte_size,object_key) VALUES ($1,$2,'admin','a.pdf','application/pdf',1,$3)", [asset, document.id, asset]);
  await pool.query('INSERT INTO juyu.revision_assets(document_id,revision_id,asset_id) VALUES ($1,1,$2)', [document.id, asset]);
  await pool.query("INSERT INTO juyu.favorites(member_id,document_id) VALUES ('staff-a',$1)", [document.id]);
  await pool.query("INSERT INTO juyu.recent_views(member_id,document_id,revision_id) VALUES ('staff-a',$1,1)", [document.id]);
  await pool.query("INSERT INTO juyu.feedback(member_id,document_id,revision_id,helpful) VALUES ('staff-a',$1,1,true)", [document.id]);
  await pool.query("INSERT INTO juyu.search_queries(id,member_id,query,result_count) VALUES ($1,'staff-a','sha256:'||encode(sha256(convert_to('测试','UTF8')),'hex'),1)", [search]);
  await pool.query('INSERT INTO juyu.search_results(search_id,position,document_id,revision_id) VALUES ($1,1,$2,1)', [search, document.id]);
  await pool.query("INSERT INTO juyu.analytics_events(id,member_id,kind,document_id,revision_id) VALUES ($1,'staff-a','view',$2,1)", [randomUUID(), document.id]);
  await pool.query("INSERT INTO juyu.notifications(id,title,body,feature_setting_id,created_by) VALUES ($1,'新功能','测试说明',$2,'admin')", [notification, feature]);
  await pool.query("INSERT INTO juyu.notification_receipts(notification_id,member_id,seen_at) VALUES ($1,'staff-a',now())", [notification]);
}

test('all supporting tables are installed by the new migration', async () => {
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='juyu' AND tablename=ANY($1::text[])", [supportingTables])).rows[0].n, 14);
});

test('renaming a category preserves version links and child identity', async () => {
  const document = await draft();
  const root = randomUUID(), child = randomUUID();
  await pool.query("INSERT INTO juyu.categories(id,name) VALUES ($1,'旧分类')", [root]);
  await pool.query("INSERT INTO juyu.categories(id,name,parent_id) VALUES ($1,'子目录',$2)", [child, root]);
  await pool.query('INSERT INTO juyu.revision_categories(document_id,revision_id,category_id) VALUES ($1,1,$2)', [document.id, child]);
  await pool.query("UPDATE juyu.categories SET name='新分类' WHERE id=$1", [root]);
  const row = (await pool.query('SELECT c.id, parent.name FROM juyu.revision_categories rc JOIN juyu.categories c ON c.id=rc.category_id JOIN juyu.categories parent ON parent.id=c.parent_id WHERE rc.document_id=$1', [document.id])).rows[0];
  assert.deepEqual(row, { id: child, name: '新分类' });
  await assert.rejects(pool.query('UPDATE juyu.categories SET parent_id=id WHERE id=$1', [root]), invalid);
  await assert.rejects(pool.query('DELETE FROM juyu.categories WHERE id=$1', [child]), /IMMUTABLE/);
  await assert.rejects(pool.query('INSERT INTO juyu.revision_categories(document_id,revision_id,category_id) VALUES ($1,99,$2)', [document.id, child]), foreignKey);
});

test('attachments cannot cross document boundaries or become public object URLs', async () => {
  const first = await draft(), second = await draft();
  const id = randomUUID();
  await pool.query("INSERT INTO juyu.assets(id,document_id,uploaded_by,filename,mime_type,byte_size,object_key) VALUES ($1,$2,'admin','说明.pdf','application/pdf',123,$3)", [id, first.id, id]);
  await pool.query('INSERT INTO juyu.revision_assets(document_id,revision_id,asset_id) VALUES ($1,1,$2)', [first.id, id]);
  await assert.rejects(pool.query('INSERT INTO juyu.revision_assets(document_id,revision_id,asset_id) VALUES ($1,1,$2)', [second.id, id]), foreignKey);
  await assert.rejects(pool.query("UPDATE juyu.assets SET object_key='https://public.example/file.pdf' WHERE id=$1", [id]), /IMMUTABLE/);
  await assert.rejects(pool.query("UPDATE juyu.assets SET bucket='public' WHERE id=$1", [id]), /IMMUTABLE/);
  const invalidAsset = randomUUID();
  await assert.rejects(pool.query("INSERT INTO juyu.assets(id,document_id,uploaded_by,filename,mime_type,byte_size,object_key) VALUES ($1,$2,'admin','a.pdf','application/pdf',1,'https://public.example/a.pdf')", [invalidAsset, first.id]), invalid);
  await assert.rejects(pool.query("INSERT INTO juyu.assets(id,document_id,uploaded_by,filename,mime_type,byte_size,object_key,bucket) VALUES ($1,$2,'admin','a.pdf','application/pdf',1,$3,'public')", [invalidAsset, first.id, invalidAsset]), invalid);
  await assert.rejects(pool.query('UPDATE juyu.assets SET byte_size=-1 WHERE id=$1', [id]), invalid);
  await pool.query("UPDATE juyu.assets SET status='ready' WHERE id=$1", [id]);
  assert.equal((await pool.query('SELECT status FROM juyu.assets WHERE id=$1', [id])).rows[0].status, 'ready');
});

test('favorites and recent views are one per member/document and never orphaned', async () => {
  const document = await draft();
  await pool.query("INSERT INTO juyu.favorites(member_id,document_id) VALUES ('staff-a',$1),('staff-b',$1)", [document.id]);
  await assert.rejects(pool.query("INSERT INTO juyu.favorites(member_id,document_id) VALUES ('staff-a',$1)", [document.id]), duplicate);
  await assert.rejects(pool.query("INSERT INTO juyu.favorites(member_id,document_id) VALUES ('missing',$1)", [document.id]), foreignKey);
  await pool.query("INSERT INTO juyu.recent_views(member_id,document_id,revision_id) VALUES ('staff-a',$1,1)", [document.id]);
  await assert.rejects(pool.query("INSERT INTO juyu.recent_views(member_id,document_id,revision_id) VALUES ('staff-a',$1,1)", [document.id]), duplicate);
  await assert.rejects(pool.query("UPDATE juyu.recent_views SET revision_id=99 WHERE document_id=$1", [document.id]), foreignKey);
  await pool.query("DELETE FROM juyu.favorites WHERE member_id='staff-a' AND document_id=$1", [document.id]);
  assert.deepEqual((await pool.query('SELECT member_id FROM juyu.favorites WHERE document_id=$1', [document.id])).rows, [{ member_id: 'staff-b' }]);
});

test('feedback updates one response per employee/version without mixing a later revision', async () => {
  const document = await draft();
  await pool.query("INSERT INTO juyu.feedback(member_id,document_id,revision_id,helpful) VALUES ('staff-a',$1,1,true)", [document.id]);
  await assert.rejects(pool.query("INSERT INTO juyu.feedback(member_id,document_id,revision_id,helpful) VALUES ('staff-a',$1,1,false)", [document.id]), duplicate);
  await pool.query("UPDATE juyu.feedback SET helpful=false,comment='需要说明' WHERE member_id='staff-a' AND document_id=$1 AND revision_id=1", [document.id]);
  await repository.execute(document.id, { type: 'edit', title: '更新', body: '更新', audience: 'staff' }, actor, { expectedSequence: document.sequence });
  await pool.query("INSERT INTO juyu.feedback(member_id,document_id,revision_id,helpful) VALUES ('staff-a',$1,2,true)", [document.id]);
  assert.deepEqual((await pool.query('SELECT revision_id,helpful FROM juyu.feedback WHERE document_id=$1 ORDER BY revision_id', [document.id])).rows, [{ revision_id: 1, helpful: false }, { revision_id: 2, helpful: true }]);
});

test('search clicks refer to an actual result belonging to the same employee', async () => {
  const document = await draft(), other = await draft();
  const search = randomUUID(), click = randomUUID();
  await pool.query("INSERT INTO juyu.search_queries(id,member_id,query,result_count) VALUES ($1,'staff-a','sha256:'||encode(sha256(convert_to('审核流程','UTF8')),'hex'),1)", [search]);
  await pool.query('INSERT INTO juyu.search_results(search_id,position,document_id,revision_id) VALUES ($1,1,$2,1)', [search, document.id]);
  const insert = "INSERT INTO juyu.analytics_events(id,member_id,kind,document_id,revision_id,search_id,result_position) VALUES ($1,$2,'search_click',$3,1,$4,1)";
  await pool.query(insert, [click, 'staff-a', document.id, search]);
  await assert.rejects(pool.query(insert, [click, 'staff-a', document.id, search]), duplicate);
  await assert.rejects(pool.query(insert, [randomUUID(), 'staff-b', document.id, search]), foreignKey);
  await assert.rejects(pool.query(insert, [randomUUID(), 'staff-a', other.id, search]), foreignKey);
  await assert.rejects(pool.query("INSERT INTO juyu.analytics_events(id,member_id,kind,document_id,revision_id) VALUES ($1,'staff-a','search_click',$2,1)", [randomUUID(), document.id]), invalid);
  await pool.query("INSERT INTO juyu.analytics_events(id,member_id,kind,document_id,revision_id) VALUES ($1,'staff-a','view',$2,1)", [randomUUID(), document.id]);
  await assert.rejects(pool.query("INSERT INTO juyu.search_queries(id,member_id,query,result_count) VALUES ($1,'staff-a','sha256:'||encode(sha256(convert_to('无结果','UTF8')),'hex'),-1)", [randomUUID()]), invalid);
});

test('settings retain immutable attributed versions and cannot point to another setting', async () => {
  const id = await setting(), other = await setting();
  await pool.query("INSERT INTO juyu.setting_versions(setting_id,version,config,changed_by) VALUES ($1,2,'{\"enabled\":true}','admin')", [id]);
  await pool.query('UPDATE juyu.settings SET current_version=2 WHERE id=$1', [id]);
  await assert.rejects(pool.query('UPDATE juyu.settings SET current_version=2 WHERE id=$1', [other]), foreignKey);
  await assert.rejects(pool.query("UPDATE juyu.setting_versions SET config='{}' WHERE setting_id=$1 AND version=1", [id]), /IMMUTABLE/);
  await assert.rejects(pool.query('DELETE FROM juyu.setting_versions WHERE setting_id=$1 AND version=1', [id]), /IMMUTABLE/);
  await assert.rejects(pool.query("INSERT INTO juyu.setting_versions(setting_id,version,config,changed_by) VALUES ($1,3,'[]','admin')", [id]), invalid);
  const row = (await pool.query('SELECT v.config,v.changed_by FROM juyu.settings s JOIN juyu.setting_versions v ON (v.setting_id,v.version)=(s.id,s.current_version) WHERE s.id=$1', [id])).rows[0];
  assert.deepEqual(row, { config: { enabled: true }, changed_by: 'admin' });
});

test('notification read/dismiss state belongs to each employee and has valid targets/times', async () => {
  const feature = await setting();
  const id = randomUUID();
  await pool.query("INSERT INTO juyu.notifications(id,title,body,audience,feature_setting_id,created_by) VALUES ($1,'新增收藏','收藏常用资料','staff',$2,'admin')", [id, feature]);
  await pool.query("INSERT INTO juyu.notification_receipts(notification_id,member_id,seen_at) VALUES ($1,'staff-a',now())", [id]);
  await pool.query("INSERT INTO juyu.notification_receipts(notification_id,member_id,dismissed_at) VALUES ($1,'staff-b',now())", [id]);
  await assert.rejects(pool.query("INSERT INTO juyu.notification_receipts(notification_id,member_id,seen_at) VALUES ($1,'staff-a',now())", [id]), duplicate);
  await assert.rejects(pool.query("UPDATE juyu.notifications SET feature_setting_id=$2 WHERE id=$1", [id, randomUUID()]), foreignKey);
  await assert.rejects(pool.query("UPDATE juyu.notifications SET expires_at=starts_at-interval '1 second' WHERE id=$1", [id]), invalid);
  assert.deepEqual((await pool.query('SELECT member_id,dismissed_at IS NOT NULL AS dismissed FROM juyu.notification_receipts WHERE notification_id=$1 ORDER BY member_id', [id])).rows, [{ member_id: 'staff-a', dismissed: false }, { member_id: 'staff-b', dismissed: true }]);
});

test('each populated supporting table denies reads and writes to a role without RLS policies', async () => {
  await seedSupportingData();
  for (const table of supportingTables) {
    assert.ok((await pool.query(`SELECT count(*)::int AS n FROM juyu.${table}`)).rows[0].n > 0, `${table} must contain data before testing RLS`);
  }
  await pool.query('CREATE ROLE test_supporting_reader NOLOGIN; GRANT USAGE ON SCHEMA juyu TO test_supporting_reader; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA juyu TO test_supporting_reader');
  const client = await pool.connect();
  try {
    await client.query('SET ROLE test_supporting_reader');
    for (const table of supportingTables) {
      assert.equal((await client.query(`SELECT count(*)::int AS n FROM juyu.${table}`)).rows[0].n, 0, table);
      assert.equal((await client.query(`DELETE FROM juyu.${table}`)).rowCount, 0, table);
    }
    await assert.rejects(client.query("INSERT INTO juyu.categories(id,name) VALUES ($1,'越权')", [randomUUID()]), { code: '42501' });
  } finally { await client.query('RESET ROLE'); client.release(); }
});

test('replaying migrations preserves supporting and core data', async () => {
  await seedSupportingData();
  const document = await draft();
  const beforeCounts = [];
  for (const table of supportingTables) beforeCounts.push((await pool.query(`SELECT count(*)::int AS n FROM juyu.${table}`)).rows[0].n);
  assert.deepEqual(await migrate(pool), []);
  const afterCounts = [];
  for (const table of supportingTables) afterCounts.push((await pool.query(`SELECT count(*)::int AS n FROM juyu.${table}`)).rows[0].n);
  assert.deepEqual(afterCounts, beforeCounts);
  assert.deepEqual(await repository.getForManagement(document.id, actor), document);
});

test('upgrading a populated T008 database adds later migrations and preserves existing documents', async () => {
  const isolated = await temporaryDatabase();
  try {
    const core = await readFile(new URL('../../src/server/database/migrations/0001_core.sql', import.meta.url), 'utf8');
    const client = await isolated.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('CREATE SCHEMA juyu; CREATE TABLE juyu.schema_migrations(version text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
      await client.query(core);
      await client.query('INSERT INTO juyu.schema_migrations(version,checksum) VALUES ($1,$2)', ['0001_core', createHash('sha256').update(core).digest('hex')]);
      await client.query("INSERT INTO juyu.members(clerk_user_id,display_name) VALUES ('admin','Admin')");
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
    const repo = new DocumentRepository(ownerTransactions(isolated.pool));
    // Populate the historical schema in its original column format. The current
    // repository intentionally requires the current migration version.
    const document = createDocument({ id: randomUUID(), title: '旧库资料', body: '保留', audience: 'staff', kind: 'article' }, actor,new Date().toISOString());
    await ownerTransactions(isolated.pool).run(actor,async client=>{
      await client.query("INSERT INTO juyu.documents(id,kind,sequence,workflow_revision_id,workflow_state) VALUES($1,'article',0,1,'draft')",[document.id]);
      await client.query("INSERT INTO juyu.revisions(document_id,revision_id,title,body,audience,author_id,editor_id,created_at) VALUES($1,1,'旧库资料','保留','staff',$2,$2,$3)",[document.id,actor.id,document.revisions[0].createdAt]);
      await client.query("INSERT INTO juyu.audit_log(document_id,sequence,action,actor_id,revision_id,at) VALUES($1,0,'create',$2,1,$3)",[document.id,actor.id,document.revisions[0].createdAt]);
    });
    assert.deepEqual(await migrate(isolated.pool), ['0002_supporting_data', '0003_authorization', '0004_members', '0005_enrollment', '0006_article_presentation', '0007_feedback', '0008_media', '0009_document_lifecycle', '0010_review_submission', '0011_document_availability', '0012_version_history', '0013_ops_collection', '0014_publication_search', '0015_reference', '0016_qa', '0017_favorites', '0018_recent_views', '0019_analytics', '0020_custom_fields', '0021_categories', '0022_forms', '0023_navigation_settings', '0024_feature_flags', '0025_setting_history', '0026_announcements', '0027_native_editor', '0028_qa_search', '0029_shared_revision_config_locks', '0030_publication_number', '0031_scoped_search', '0032_category_icons', '0033_publication_icons', '0034_article_description', '0035_publication_timestamp', '0036_reader_changelog', '0037_reusable_fragments', '0038_reusable_fragment_versions', '0039_release_notes', '0040_document_locales']);
    assert.deepEqual(await repo.getForManagement(document.id, actor), document);
    assert.deepEqual(await migrate(isolated.pool), []);
  } finally { await isolated.close(); }
});
