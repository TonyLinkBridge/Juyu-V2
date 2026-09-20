import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {before,after,beforeEach,test} from 'node:test';
import {randomBytes,randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import {temporaryDatabase} from './fixture.ts';
import {migrate} from '../../src/server/database/migrate.ts';
import {ScopedDatabase} from '../../src/server/database/scoped.ts';
import {DocumentRepository} from '../../src/server/database/repository.ts';
import {AuthorizationService} from '../../src/server/authorization/service.ts';
import {encodeEditorBody} from '../../src/editor/document.ts';
import {readCategoryDefinitions,writeCategoryDefinition} from '../../src/server/categories/repository.ts';
import type {CategoryWrite} from '../../src/categories/model.ts';
import type {Viewer,Document} from '../../src/domain/model.ts';
let fixture:Awaited<ReturnType<typeof temporaryDatabase>>,runtime:Pool,issuer:Pool,db:ScopedDatabase,repo:DocumentRepository;
const admin:Viewer={id:'a',role:'admin',companyVerified:true},reviewer:Viewer={...admin,id:'b'},support:Viewer={id:'s',role:'support',companyVerified:true},ops:Viewer={id:'o',role:'ops',companyVerified:true};
const service=(v:Viewer=admin)=>new AuthorizationService(db,async()=>v);
const config:CategoryWrite={expectedVersion:null,name:'分类',parentId:null,position:0,audience:'staff',enabled:true};
const write=(id:string,value:CategoryWrite=config,v=admin)=>db.run(v,c=>writeCategoryDefinition(c,id,value));
const read=(v=admin)=>db.run(v,c=>readCategoryDefinitions(c),true);
const input={expectedSequence:null,title:'字段文章',body:encodeEditorBody([{id:'p',type:'paragraph',content:[{type:'text',text:'正文',styles:{}}]}]),kind:'article',audience:'staff',tags:[],cover:null};
async function publish(d:Document){await service().submitReview(d.id,{expectedSequence:d.sequence,reviewerId:'b'});await service(reviewer).decideReview(d.id,{expectedSequence:d.sequence+1,action:'approve'});await service().changePublication(d.id,{expectedSequence:d.sequence+2,action:'queue'});await service().changePublication(d.id,{expectedSequence:d.sequence+3,action:'publish'});return (await repo.getForManagement(d.id,admin))!;}
before(async()=>{fixture=await temporaryDatabase();await migrate(fixture.pool);await fixture.pool.query("INSERT INTO juyu.members(clerk_user_id,display_name,observed_role,verified_email,observed_at) VALUES('a','Admin','admin','a@example.test',now()),('b','Reviewer','admin','b@example.test',now()),('s','Support','support','s@example.test',now()),('o','Ops','ops','o@example.test',now())");const rp=randomBytes(24).toString('hex'),ip=randomBytes(24).toString('hex');await fixture.pool.query(`CREATE ROLE categories_runtime LOGIN PASSWORD '${rp}' IN ROLE juyu_runtime; CREATE ROLE categories_issuer LOGIN PASSWORD '${ip}' IN ROLE juyu_context_issuer`);runtime=fixture.connectAs('categories_runtime',rp);issuer=fixture.connectAs('categories_issuer',ip);db=new ScopedDatabase(runtime,issuer);repo=new DocumentRepository(db);});
after(async()=>{await runtime?.end();await issuer?.end();await fixture?.close();});
beforeEach(async()=>{await fixture.pool.query('TRUNCATE juyu.documents,juyu.settings,juyu.categories CASCADE');});
test('category settings CAS exact actor retry immutable audit and runtime access',async()=>{
 const id=randomUUID(),first=await write(id);assert.equal(first.version,1);assert.deepEqual(await write(id),first);assert.deepEqual(await read(),[first]);
 await assert.rejects(write(id,{...config,name:'changed'}),/CATEGORY_CONFLICT/);await assert.rejects(write(id,config,reviewer),/CATEGORY_CONFLICT/);
 const next=await write(id,{...config,expectedVersion:1,name:'renamed',position:12});assert.equal(next.version,2);assert.deepEqual(await write(id,{...config,expectedVersion:1,name:'renamed',position:12}),next);
 for(const v of [support,ops]){await assert.rejects(read(v),/FORBIDDEN/);await assert.rejects(write(randomUUID(),config,v),/FORBIDDEN/);}
 await assert.rejects(runtime.query('SELECT juyu.read_category_definitions()'),/FORBIDDEN/);
 await assert.rejects(db.run(admin,c=>c.query('UPDATE juyu.categories SET enabled=false WHERE id=$1',[id])),/permission denied/);
 await assert.rejects(db.run(admin,c=>c.query('INSERT INTO juyu.category_versions(category_id,version,config) VALUES($1,3,\'{}\')',[id])),/permission denied/);
 await assert.rejects(fixture.pool.query('DELETE FROM juyu.categories WHERE id=$1',[id]),/IMMUTABLE/);
 await assert.rejects(fixture.pool.query('UPDATE juyu.category_versions SET config=\'{}\' WHERE category_id=$1',[id]),/IMMUTABLE/);
 assert.equal((await fixture.pool.query('SELECT count(*)::int n FROM juyu.category_versions')).rows[0].n,2);
 for(const state of ["disabled_at=now()","observed_role='ops'","verified_email=null","observed_at=null"]){await fixture.pool.query(`UPDATE juyu.members SET ${state} WHERE clerk_user_id='a'`);try{await assert.rejects(read(),/FORBIDDEN/);await assert.rejects(write(randomUUID()),/FORBIDDEN/);}finally{await fixture.pool.query("UPDATE juyu.members SET disabled_at=null,observed_role='admin',verified_email='a@example.test',observed_at=now() WHERE clerk_user_id='a'");}}
});
test('chosen category icon survives renames and appears only in authorized directory',async()=>{
 const id=randomUUID();const first=await write(id,{...config,name:'自定义目录',iconKey:'shield'});
 assert.equal(first.iconKey,'shield');assert.equal((await read())[0].iconKey,'shield');
 const articleId=randomUUID();await repo.saveEditor(articleId,{...input,categoryIds:[id]},admin);await publish((await repo.getForManagement(articleId,admin))!);
 const reader=await service(support).reader(articleId);assert.equal(reader.pages[0]?.type,'group');
 if(reader.pages[0]?.type==='group')assert.equal(reader.pages[0].iconKey,'shield');
 const again=await write(id,{...config,name:'自定义目录',iconKey:'shield'});assert.deepEqual(again,first);
 const renamed=await write(id,{...config,expectedVersion:1,name:'新版名称',iconKey:'shield'});
 assert.equal(renamed.iconKey,'shield');assert.equal((await read())[0].iconKey,'shield');
 await assert.rejects(write(randomUUID(),{...config,iconKey:'unknown' as 'shield'}),/INVALID_INPUT/);
});
test('human-written English category labels appear only in the English directory',async()=>{
 const id=randomUUID(),source=randomUUID(),english=randomUUID();
 const category=await write(id,{...config,name:'账户管理',englishName:'Account management'});
 assert.equal(category.englishName,'Account management');
 assert.equal((await read())[0].englishName,'Account management');
 await repo.saveEditor(source,{...input,title:'修改邮箱',categoryIds:[id]},admin);
 await publish((await repo.getForManagement(source,admin))!);
 await repo.saveEditor(english,{...input,locale:'en',translationOf:source,title:'Change your account email',categoryIds:[id]},admin);
 await publish((await repo.getForManagement(english,admin))!);
 const chinese=await service(support).reader(source),translated=await service(support).reader(english);
 assert.equal(chinese.pages[0]?.type,'group');assert.equal(translated.pages[0]?.type,'group');
 if(chinese.pages[0]?.type==='group'&&translated.pages[0]?.type==='group'){
  assert.equal(chinese.pages[0].title,'账户管理');assert.equal(translated.pages[0].title,'Account management');
 }
 await assert.rejects(db.run(support,c=>c.query('SELECT juyu.set_category_english_name($1,$2,$3)',[id,1,'Fake category'])),/FORBIDDEN/);
 await assert.rejects(db.run(admin,c=>c.query('UPDATE juyu.category_english_names SET name=$2 WHERE category_id=$1',[id,'Fake category'])),/permission denied/);
});
test('article icon follows the published revision and stays private during draft edits',async()=>{
 const id=randomUUID();const saved=await repo.saveEditor(id,{...input,iconKey:'shield'},admin);
 assert.equal(saved.iconKey,'shield');assert.equal(await service(support).article(id),null);
 const published=await publish((await repo.getForManagement(id,admin))!);
 assert.equal((await service(support).article(id))?.iconKey,'shield');
 const visible=await service(support).reader(id);assert.equal(visible.pages[0]?.type,'document');
 if(visible.pages[0]?.type==='document')assert.equal(visible.pages[0].iconKey,'shield');
 const updated=await repo.saveEditor(id,{...input,expectedSequence:published.sequence,iconKey:'leaf'},admin);
 assert.equal(updated.iconKey,'leaf');assert.equal((await service(support).article(id))?.iconKey,'shield');
 const republished=await publish((await repo.getForManagement(id,admin))!);
 assert.equal((await service(support).article(id))?.iconKey,'leaf');
 await service(admin).restoreVersion(id,{expectedSequence:republished.sequence,sourceRevision:1});
 assert.equal((await repo.getEditor(id,admin)).iconKey,'shield');
 assert.equal((await service(support).article(id))?.iconKey,'leaf');
});
test('category tree serializes concurrent cycles depth and inclusive disabled limit',async()=>{
 const a=await write(randomUUID()),b=await write(randomUUID());const moved=await Promise.allSettled([write(a.id,{...config,expectedVersion:1,parentId:b.id}),write(b.id,{...config,expectedVersion:1,parentId:a.id})]);assert.equal(moved.filter(r=>r.status==='fulfilled').length,1);assert.match(String((moved.find(r=>r.status==='rejected') as PromiseRejectedResult).reason),/CATEGORY_CYCLE/);
 let parent:string|null=null;for(let i=0;i<10;i++)parent=(await write(randomUUID(),{...config,parentId:parent})).id;await assert.rejects(write(randomUUID(),{...config,parentId:parent}),/CATEGORY_DEPTH/);
 await assert.rejects(write(randomUUID(),{...config,parentId:randomUUID()}),/INVALID_INPUT/);
 for(let i=12;i<99;i++)await write(randomUUID(),{...config,enabled:false});const cap=await Promise.allSettled([write(randomUUID()),write(randomUUID())]);assert.equal(cap.filter(r=>r.status==='fulfilled').length,1);assert.equal((await read()).length,100);
});
test('new draft memberships preserve formal versions omission and historical restore',async()=>{
 const a=await write(randomUUID()),b=await write(randomUUID());const id=randomUUID();const saved=await repo.saveEditor(id,{...input,categoryIds:[a.id]},admin);assert.deepEqual(saved.categoryIds,[a.id]);assert.equal(saved.categoryOptions?.length,2);assert.deepEqual(await repo.saveEditor(id,{...input,categoryIds:[a.id]},admin),saved);
 let d=await publish((await repo.getForManagement(id,admin))!);const next=await repo.saveEditor(id,{...input,expectedSequence:d.sequence,categoryIds:[b.id]},admin);
 assert.deepEqual((await repo.getForManagement(id,admin))!.revisions[0].categoryIds,[a.id]);assert.deepEqual(next.categoryIds,[b.id]);
 const preserved=await repo.saveEditor(id,{...input,expectedSequence:next.sequence},admin);assert.deepEqual(preserved.categoryIds,[b.id]);
 const cleared=await repo.saveEditor(id,{...input,expectedSequence:preserved.sequence,categoryIds:[]},admin);assert.deepEqual(cleared.categoryIds,[]);assert.equal(cleared.publishedRevision,1);
 await assert.rejects(repo.saveEditor(id,{...input,expectedSequence:preserved.sequence,categoryIds:[b.id]},admin),/CONFLICT/);
 await write(a.id,{...config,expectedVersion:1,enabled:false});await service().restoreVersion(id,{expectedSequence:cleared.sequence,sourceRevision:1});assert.deepEqual((await repo.getEditor(id,admin)).categoryIds,[a.id]);
 d=(await repo.getForManagement(id,admin))!;await service().submitReview(id,{expectedSequence:d.sequence,reviewerId:'b'});assert.deepEqual((await service(reviewer).reviewDetail(id)).article.categoryIds,[a.id]);
});
test('membership rejects unknown disabled ancestors duplicate overflow raw association and unbound drafts',async()=>{
 const root=await write(randomUUID()),child=await write(randomUUID(),{...config,parentId:root.id});const id=randomUUID();let saved=await repo.saveEditor(id,{...input,categoryIds:[child.id]},admin);
 await write(root.id,{...config,expectedVersion:1,enabled:false});await assert.rejects(repo.saveEditor(randomUUID(),{...input,categoryIds:[child.id]},admin),/INVALID_INPUT/);
 saved=await repo.saveEditor(id,{...input,expectedSequence:saved.sequence},admin);assert.deepEqual(saved.categoryIds,[child.id]);
 for(const categoryIds of [[randomUUID()],[child.id,child.id],Array.from({length:21},()=>randomUUID())])await assert.rejects(repo.saveEditor(id,{...input,expectedSequence:saved.sequence,categoryIds},admin),/INVALID_(INPUT|CATEGORY)/);
 await assert.rejects(db.run(admin,c=>c.query('INSERT INTO juyu.revision_categories VALUES($1,$2,$3)',[id,saved.sequence+1,root.id])),/permission denied/);
 await assert.rejects(db.run(admin,c=>c.query("INSERT INTO juyu.revisions(document_id,revision_id,title,body,audience,author_id,editor_id,created_at) VALUES($1,$2,'Raw','raw','staff','a','a',now())",[id,saved.sequence+2])),/category draft binding/);
 await assert.rejects(db.run(admin,c=>c.query("INSERT INTO juyu.revisions(document_id,revision_id,title,body,audience,author_id,editor_id,created_at,category_binding_required) VALUES($1,$2,'Forged','raw','staff','a','a',now(),false)",[id,saved.sequence+2])),/category draft binding/);
 assert.deepEqual((await repo.getEditor(id,admin)).categoryIds,[child.id]);
});
test('current inherited category policy gates navigation tree search article assets and PDF',async()=>{
 const parent=await write(randomUUID()),child=await write(randomUUID(),{...config,parentId:parent.id});const id=randomUUID();await repo.saveEditor(id,{...input,title:'针尖分类',categoryIds:[child.id]},admin);await publish((await repo.getForManagement(id,admin))!);
 const asset=randomUUID();await fixture.pool.query("INSERT INTO juyu.assets(id,document_id,uploaded_by,filename,mime_type,byte_size,object_key,status) VALUES($1::uuid,$2,'a','test.pdf','application/pdf',12,$1::text,'ready')",[asset,id]);await fixture.pool.query("INSERT INTO juyu.revision_assets(document_id,revision_id,asset_id,usage) VALUES($1,1,$2,'attachment')",[id,asset]);
 const assetAllowed=(v:Viewer)=>db.run(v,async c=>(await c.query('SELECT juyu.can_read_asset($1) AS ok',[asset])).rows[0].ok,true);
 const check=async(v:Viewer,allowed:boolean)=>{const s=service(v);assert.equal(!!await s.article(id),allowed);assert.equal((await s.navigation()).some(p=>p.id===id),allowed);assert.equal(JSON.stringify(await s.navigationTree()).includes(id),allowed);assert.equal((await s.search('针尖')).search.total,allowed?1:0);assert.equal(await assetAllowed(v),allowed);if(allowed)assert.equal((await s.pdf(id,1)).article.id,id);else await assert.rejects(s.pdf(id,1),/NOT_FOUND/);};
 await check(support,true);await write(parent.id,{...config,expectedVersion:1,audience:'ops'});await check(support,false);await check(ops,true);await write(parent.id,{...config,expectedVersion:2,audience:'admin'});await check(ops,false);await check(admin,true);await write(parent.id,{...config,expectedVersion:3,enabled:false});await check(admin,false);
});
test('SQL rejects malformed category config and concurrent exact retries audit once',async()=>{
 const id=randomUUID();const results=await Promise.all([write(id),write(id)]);assert.deepEqual(results[0],results[1]);
 const {expectedVersion,...rest}=config;assert.equal(expectedVersion,null);
 for(const patch of [{name:''},{name:' x'},{name:'\u00a0'},{name:'x\u0081'},{position:1000000},{position:1.5},{parentId:1},{audience:'support'},{extra:true},{enabled:'true'}])await assert.rejects(db.run(admin,c=>c.query('SELECT juyu.write_category_definition($1,1,$2)',[id,JSON.stringify({...rest,...patch})])),/INVALID_INPUT/);
 assert.equal((await fixture.pool.query('SELECT count(*)::int n FROM juyu.category_versions')).rows[0].n,1);
});
async function waitForLock(query:string){const deadline=Date.now()+3000;while(Date.now()<deadline){if((await fixture.pool.query("SELECT count(*)::int n FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE $1",[query])).rows[0].n>0)return;await new Promise(r=>setTimeout(r,5));}assert.fail('concurrent database lock not reached');}
test('pending member changes and enrollment block category access; demotion is rechecked after wait',async()=>{
 const op=(await fixture.pool.query("INSERT INTO juyu.member_operations(actor_id,target_id,kind,requested_role) VALUES('b','a','role','support') RETURNING id")).rows[0].id;
 try{await assert.rejects(read(),/FORBIDDEN/);await assert.rejects(write(randomUUID()),/FORBIDDEN/);}finally{await fixture.pool.query("UPDATE juyu.member_operations SET status='conflict',finished_at=now() WHERE id=$1",[op]);}
 await fixture.pool.query("INSERT INTO juyu.role_enrollments(member_id,requested_role,purpose) VALUES('a','support','default')");try{await assert.rejects(read(),/FORBIDDEN/);await assert.rejects(write(randomUUID()),/FORBIDDEN/);}finally{await fixture.pool.query("UPDATE juyu.role_enrollments SET state='complete',confirmed_at=now() WHERE member_id='a'");}
 const blocker=await fixture.pool.connect();await blocker.query('BEGIN');await blocker.query("UPDATE juyu.members SET observed_role='ops' WHERE clerk_user_id='a'");const writing=write(randomUUID()).then(()=>null,error=>error);
 try{await waitForLock('SELECT juyu.write_category_definition%');}finally{await blocker.query('COMMIT');blocker.release();}try{assert.match((await writing)?.message??'unexpected success',/FORBIDDEN/);}finally{await fixture.pool.query("UPDATE juyu.members SET observed_role='admin' WHERE clerk_user_id='a'");}
});
test('concurrent disable is rechecked when saving a newly selected category',async()=>{
 const category=await write(randomUUID());let unlock!:()=>void,locked!:()=>void;const acquired=new Promise<void>(r=>{locked=r;}),release=new Promise<void>(r=>{unlock=r;});
 const changing=db.run(admin,async c=>{await writeCategoryDefinition(c,category.id,{...config,expectedVersion:1,enabled:false});locked();await release;});await acquired;
 const id=randomUUID(),saving=repo.saveEditor(id,{...input,categoryIds:[category.id]},admin).then(()=>null,error=>error);try{await waitForLock('SELECT pg_advisory_xact_lock_shared(84620949)%');}finally{unlock();}await changing;assert.match((await saving)?.message??'unexpected success',/INVALID_INPUT/);assert.equal(await repo.getForManagement(id,admin),null);
});
test('moving a selected child under restrictive parent immediately changes all current readers',async()=>{
 const parent=await write(randomUUID(),{...config,audience:'admin'}),child=await write(randomUUID());const id=randomUUID();await repo.saveEditor(id,{...input,categoryIds:[child.id]},admin);await publish((await repo.getForManagement(id,admin))!);assert.ok(await service(support).article(id));
 await write(child.id,{...config,expectedVersion:1,parentId:parent.id});assert.equal(await service(support).article(id),null);assert.ok(await service(admin).article(id));assert.equal((await repo.getForManagement(id,admin))!.publishedRevisionId,1);
 await write(child.id,{...config,expectedVersion:2,parentId:null});assert.ok(await service(support).article(id));assert.deepEqual((await repo.getEditor(id,admin)).categoryIds,[child.id]);
});
test('migration upgrades existing category identities memberships and historical revisions without rewriting evidence',async()=>{
 const old=await temporaryDatabase();try{
 await old.pool.query('CREATE SCHEMA juyu; CREATE TABLE juyu.schema_migrations(version text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
 const versions=(await fixture.pool.query("SELECT version FROM juyu.schema_migrations WHERE version<'0021_categories' ORDER BY version")).rows;
 for(const {version} of versions){const sql=await readFile(new URL(`../../src/server/database/migrations/${version}.sql`,import.meta.url),'utf8');await old.pool.query(sql);await old.pool.query('INSERT INTO juyu.schema_migrations(version,checksum) VALUES($1,$2)',[version,createHash('sha256').update(sql).digest('hex')]);}
 const category=randomUUID();await old.pool.query("INSERT INTO juyu.members(clerk_user_id,display_name) VALUES('seed','Seed'); INSERT INTO juyu.categories(id,name) VALUES('"+category+"','Existing')");
 const c=await old.pool.connect();try{await c.query('BEGIN');await c.query("INSERT INTO juyu.documents(id,kind,sequence,lifecycle,workflow_revision_id,workflow_state) VALUES('legacy','article',0,'active',1,'draft')");await c.query("INSERT INTO juyu.revisions(document_id,revision_id,title,body,audience,author_id,editor_id,created_at) VALUES('legacy',1,'Legacy','Existing body','staff','seed','seed',now())");await c.query("INSERT INTO juyu.revision_categories VALUES('legacy',1,$1)",[category]);await c.query("INSERT INTO juyu.audit_log(document_id,sequence,action,actor_id,revision_id,at) VALUES('legacy',0,'create','seed',1,now())");await c.query('COMMIT');}finally{c.release();}
 assert.deepEqual(await migrate(old.pool),['0021_categories', '0022_forms', '0023_navigation_settings', '0024_feature_flags', '0025_setting_history', '0026_announcements', '0027_native_editor', '0028_qa_search', '0029_shared_revision_config_locks', '0030_publication_number', '0031_scoped_search', '0032_category_icons', '0033_publication_icons', '0034_article_description', '0035_publication_timestamp', '0036_reader_changelog', '0037_reusable_fragments', '0038_reusable_fragment_versions', '0039_release_notes', '0040_document_locales']);assert.deepEqual(await migrate(old.pool),[]);assert.deepEqual((await old.pool.query("SELECT category_ids FROM juyu.revisions WHERE document_id='legacy'")).rows[0].category_ids,[category]);assert.equal((await old.pool.query('SELECT category_id FROM juyu.category_versions')).rows[0].category_id,category);assert.equal((await old.pool.query("SELECT body FROM juyu.revisions WHERE document_id='legacy'")).rows[0].body,'Existing body');
 }finally{await old.close();}
});


test('R23 different document saves share config locks while settings writers still wait',async()=>{
 const category=await write(randomUUID());const first=randomUUID(),second=randomUUID();
 let unlock!:()=>void,locked!:()=>void;const acquired=new Promise<void>(r=>{locked=r;}),release=new Promise<void>(r=>{unlock=r;});
 const holding=new DocumentRepository({run(v,work,ro){return db.run(v,async c=>{const result=await work(c);locked();await release;return result;},ro);}});
 const saving=holding.saveEditor(first,{...input,categoryIds:[category.id]},admin);await acquired;
 const bounded=new DocumentRepository({run(v,work,ro){return db.run(v,async c=>{await c.query("SET LOCAL statement_timeout='1500ms'");return work(c);},ro);}});
 try{
  const saved=await bounded.saveEditor(second,{...input,categoryIds:[category.id]},reviewer);assert.equal(saved.sequence,0);
  // Configuration changes must still wait for the active save transaction.
  await assert.rejects(db.run(reviewer,async c=>{await c.query("SET LOCAL statement_timeout='150ms'");return writeCategoryDefinition(c,category.id,{...config,expectedVersion:1,enabled:false});}),/statement timeout/);
 }finally{unlock();await saving;}
 await write(category.id,{...config,expectedVersion:1,enabled:false});
 await assert.rejects(repo.saveEditor(randomUUID(),{...input,categoryIds:[category.id]},admin),/INVALID_INPUT/);
 assert.equal((await repo.getEditor(first,admin)).sequence,0);assert.equal((await repo.getEditor(second,reviewer)).sequence,0);
});
