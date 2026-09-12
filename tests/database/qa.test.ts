import {readFile,readdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {before,after,beforeEach,test} from 'node:test';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import type {Pool} from 'pg';
import {temporaryDatabase} from './fixture.ts';
import {migrate} from '../../src/server/database/migrate.ts';
import {ScopedDatabase} from '../../src/server/database/scoped.ts';
import {DocumentRepository} from '../../src/server/database/repository.ts';
import {AuthorizationService} from '../../src/server/authorization/service.ts';
import {encodeEditorBody} from '../../src/editor/document.ts';
import type {Viewer,Document} from '../../src/domain/model.ts';
import type {MediaBlock} from '../../src/media/model.ts';
let fixture:Awaited<ReturnType<typeof temporaryDatabase>>,runtime:Pool,issuer:Pool,db:ScopedDatabase,repo:DocumentRepository;
const admin:Viewer={id:'a',role:'admin',companyVerified:true},reviewer:Viewer={...admin,id:'b'},ops:Viewer={id:'o',role:'ops',companyVerified:true},support:Viewer={id:'s',role:'support',companyVerified:true};
const service=(v:Viewer|null=support)=>new AuthorizationService(db,async()=>v);
async function draft(title='Reference formal',kind:Document['kind']='reference',audience:'ops'|'admin'|'staff'='staff',body='Formal body',blocks:MediaBlock[]=[]){return repo.create({id:randomUUID(),kind,title,audience,body,blocks,tags:['Formal tag']},admin);}
async function publish(d:Document){await service(admin).submitReview(d.id,{expectedSequence:d.sequence,reviewerId:'b'});await service(reviewer).decideReview(d.id,{expectedSequence:d.sequence+1,action:'approve'});await service(admin).changePublication(d.id,{expectedSequence:d.sequence+2,action:'queue'});await service(admin).changePublication(d.id,{expectedSequence:d.sequence+3,action:'publish'});return (await repo.getForManagement(d.id,admin))!;}
before(async()=>{fixture=await temporaryDatabase();await migrate(fixture.pool);await fixture.pool.query("INSERT INTO juyu.members(clerk_user_id,display_name,observed_role,verified_email,observed_at) VALUES('a','Admin','admin','a@example.test',now()),('b','Reviewer','admin','b@example.test',now()),('o','Ops','ops','o@example.test',now()),('s','Support','support','s@example.test',now())");const rp=randomBytes(24).toString('hex'),ip=randomBytes(24).toString('hex');await fixture.pool.query(`CREATE ROLE reference_runtime LOGIN PASSWORD '${rp}' IN ROLE juyu_runtime; CREATE ROLE reference_issuer LOGIN PASSWORD '${ip}' IN ROLE juyu_context_issuer`);runtime=fixture.connectAs('reference_runtime',rp);issuer=fixture.connectAs('reference_issuer',ip);db=new ScopedDatabase(runtime,issuer);repo=new DocumentRepository(db);});
after(async()=>{await runtime?.end();await issuer?.end();await fixture?.close();});
beforeEach(async()=>{await fixture.pool.query('TRUNCATE juyu.documents CASCADE');});

const answer=(text:string)=>encodeEditorBody([{id:'answer',type:'paragraph',content:[{type:'text',text,styles:{}}]}]);
const input={expectedSequence:null,title:'Question',body:answer('OldAnswerText'),kind:'qa',audience:'staff',tags:['Help'],cover:null,qa:{category:'Billing',position:8}};
async function collection(v:Viewer=support,page=1,category?:string){const {readQa}=await import('../../src/server/qa/repository.ts');return db.run(v,c=>readQa(c,page,category),true);}
test('QA metadata survives creation replay draft review publication and version restoration',async()=>{
 const id=randomUUID();const saved=await service(admin).saveDraft(id,input);assert.deepEqual(saved.qa,input.qa);
 assert.deepEqual((await service(admin).saveDraft(id,{...input,qa:{category:' Billing ',position:8}})).qa,input.qa);
 await assert.rejects(service(admin).saveDraft(id,{...input,qa:{category:'Other',position:8}}),/CONFLICT/);
 let d=await publish((await repo.getForManagement(id,admin))!);
 const old=await collection();assert.equal(old.items[0].category,'Billing');assert.equal(old.items[0].position,8);
 const edit={...input,expectedSequence:d.sequence,qa:{category:'General',position:1},title:'New question',body:answer('NewAnswerText')};
 await service(admin).saveDraft(id,edit);assert.deepEqual(await collection(),old);
 assert.deepEqual((await service(admin).saveDraft(id,{...edit,qa:{category:' General ',position:1}})).qa,edit.qa);
 await assert.rejects(service(admin).saveDraft(id,{...edit,qa:{category:'General',position:2}}),/CONFLICT/);
 assert.equal((await service().search('OldAnswerText')).search.total,1);assert.equal((await service().search('NewAnswerText')).search.total,0);assert.match(JSON.stringify(await service().pdf(id,1)),/OldAnswerText/);assert.doesNotMatch(JSON.stringify(await service().pdf(id,1)),/NewAnswerText/);
 d=(await repo.getForManagement(id,admin))!;
 await service(admin).submitReview(id,{expectedSequence:d.sequence,reviewerId:'b'});
 assert.deepEqual((await service(reviewer).reviewDetail(id)).article.qa,edit.qa);
 await assert.rejects(service(admin).saveDraft(id,{...edit,expectedSequence:d.sequence+1}),/INVALID_STATE/);
 await assert.rejects(service(admin).decideReview(id,{expectedSequence:d.sequence+1,action:'approve'}),/NOT_REVIEWER/);
 assert.deepEqual(await collection(),old);
 await service(reviewer).decideReview(id,{expectedSequence:d.sequence+1,action:'approve'});
 await service(admin).changePublication(id,{expectedSequence:d.sequence+2,action:'queue'});
 assert.deepEqual((await service(admin).publicationDetail(id)).article.qa,edit.qa);assert.deepEqual(await collection(),old);
 await service(admin).changePublication(id,{expectedSequence:d.sequence+3,action:'publish'});
 assert.equal((await collection()).items[0].category,'General');assert.equal((await collection()).items[0].revision,2);
 assert.equal((await service().search('OldAnswerText')).search.total,0);assert.equal((await service().search('NewAnswerText')).search.total,1);assert.match(JSON.stringify(await service().pdf(id,2)),/NewAnswerText/);await assert.rejects(service().pdf(id,1),/VERSION_CHANGED/);
 assert.deepEqual((await service(admin).historyVersion(id,1)).version.qa,input.qa);
 const current=(await repo.getForManagement(id,admin))!;
 await service(admin).restoreVersion(id,{expectedSequence:current.sequence,sourceRevision:1});
 assert.deepEqual((await service(admin).editor(id)).qa,input.qa);assert.equal((await collection()).items[0].category,'General');
 const omitted={...input,expectedSequence:current.sequence+1};delete (omitted as {qa?:unknown}).qa;
 const legacySaved=await service(admin).saveDraft(id,omitted);assert.deepEqual(legacySaved.qa,input.qa);
 const afterLegacySave=await repo.getForManagement(id,admin);
 assert.deepEqual(await service(admin).saveDraft(id,omitted),legacySaved);
 assert.deepEqual(await repo.getForManagement(id,admin),afterLegacySave);
 const later=await service(admin).saveDraft(id,{...omitted,expectedSequence:legacySaved.sequence,title:'Later question',qa:{category:'Later category',position:15}});
 await assert.rejects(service(admin).saveDraft(id,omitted),/CONFLICT/);
 assert.deepEqual(await service(admin).editor(id),later);assert.deepEqual(later.qa,{category:'Later category',position:15});
 await assert.rejects(fixture.pool.query("UPDATE juyu.revisions SET qa_position=99 WHERE document_id=$1",[id]),/immutable|IMMUTABLE/i);
});
test('QA collection applies published permissions stable ordering exact category and true pagination',async()=>{
 for(let i=0;i<22;i++)await publish(await repo.create({id:randomUUID(),kind:'qa',title:i<2?'A tie':`B ${String(i).padStart(2,'0')}`,body:'Private answer',audience:'staff',qa:{category:i===21?'':i===20?'billing':'Billing',position:i===21?99:0}},admin));
 await publish(await draft('Hidden','qa','admin'));await draft('Draft','qa');await publish(await draft('Article','article'));
 const first=await collection(),last=await collection(support,999);assert.equal(first.total,22);assert.equal(first.items.length,20);assert.equal(last.page,2);assert.deepEqual(last.items.map(x=>x.title),['B 20','B 21']);assert.ok(first.items[0].id<first.items[1].id);
 assert.equal((await collection(support,1,'Billing')).total,20);assert.equal((await collection(support,1,'billing')).total,1);assert.equal((await collection(support,1,'')).total,1);assert.equal((await collection(support,1,' Billing')).total,0);assert.equal((await collection(admin)).canEdit,true);assert.equal((await collection(ops)).canEdit,false);
 assert.ok(!JSON.stringify(first).includes('Private answer'));
 for(const page of [0,-1,NaN,1.2,2147483648])await assert.rejects(collection(support,page),/INVALID_INPUT/);
 for(const category of [null,[],12,'x'.repeat(81),'x\n'])await assert.rejects(collection(support,1,category as string),/INVALID_INPUT/);
});
test('QA collection excludes revoked identities denied access categories and unavailable publications',async()=>{
 const d=await publish(await draft('QA','qa'));const cat=randomUUID();await fixture.pool.query("INSERT INTO juyu.categories(id,name,audience) VALUES($1,'Restricted','admin')",[cat]);await fixture.pool.query('INSERT INTO juyu.revision_categories VALUES($1,1,$2)',[d.id,cat]);
 assert.equal((await collection()).total,0);assert.equal((await collection(admin)).total,1);
 await fixture.pool.query('UPDATE juyu.categories SET enabled=false WHERE id=$1',[cat]);assert.equal((await collection(admin)).total,0);
 for(const state of ["disabled_at=now()","observed_role='ops'","verified_email=null","observed_at=null"]){await fixture.pool.query(`UPDATE juyu.members SET ${state} WHERE clerk_user_id='s'`);try{await assert.rejects(collection(),/FORBIDDEN/);}finally{await fixture.pool.query("UPDATE juyu.members SET disabled_at=null,observed_role='support',verified_email='s@example.test',observed_at=now() WHERE clerk_user_id='s'");}}
 for(const v of [support,ops])await assert.rejects(service(v).saveDraft(randomUUID(),input),/FORBIDDEN/);
 const active=await publish(await draft('Active','qa'));await service(admin).changeAvailability(active.id,{expectedSequence:active.sequence,action:'archive'});assert.equal((await collection()).total,0);
});
test('QA SQL projection exposes authorized metadata only and has no anonymous execute ACL',async()=>{
 await publish(await draft('QA','qa'));await assert.rejects(runtime.query('SELECT * FROM juyu.read_qa_publications()'),/FORBIDDEN/);
 assert.equal((await fixture.pool.query("SELECT EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE p.oid='juyu.read_qa_publications()'::regprocedure AND a.grantee=0 AND a.privilege_type='EXECUTE') ok")).rows[0].ok,false);
 const rows=await db.run(support,async c=>(await c.query('SELECT * FROM juyu.read_qa_publications()')).rows);assert.deepEqual(Object.keys(rows[0]).sort(),['category','id','position','revision','tags','title']);
 const unpublished=await draft('Hidden draft','qa');
 assert.deepEqual(await db.run(support,async c=>(await c.query('SELECT * FROM juyu.revisions WHERE document_id=$1',[unpublished.id])).rows),[]);
 assert.deepEqual(await db.run(support,async c=>(await c.query('SELECT * FROM juyu.documents')).rows),[]);
});

test('QA database validates metadata even on raw inserts',async()=>{
 const d=await draft('Draft','qa');
 for(const [category,position] of [['x',-1],['x',1000000],['x'.repeat(81),0],['x\n',0],[' x ',0]])await assert.rejects(fixture.pool.query("INSERT INTO juyu.revisions(document_id,revision_id,title,body,audience,author_id,editor_id,created_at,qa_category,qa_position) VALUES($1,2,'Q','A','staff','a','a',now(),$2,$3)",[d.id,category,position]),/check constraint/);
});
test('QA migration upgrades existing QA revisions with defaults and is replay safe',async()=>{
 const old=await temporaryDatabase();try{
  await old.pool.query('CREATE SCHEMA juyu; CREATE TABLE juyu.schema_migrations(version text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
  const directory=new URL('../../src/server/database/migrations/',import.meta.url);
  for(const file of (await readdir(directory)).filter(file=>file.endsWith('.sql')&&file<'0016').sort()){
   const sql=await readFile(new URL(file,directory),'utf8');await old.pool.query(sql);await old.pool.query('INSERT INTO juyu.schema_migrations(version,checksum) VALUES($1,$2)',[file.slice(0,-4),createHash('sha256').update(sql).digest('hex')]);
  }
  await old.pool.query("BEGIN; INSERT INTO juyu.members(clerk_user_id,display_name) VALUES('a','Admin'); INSERT INTO juyu.documents(id,kind,sequence,workflow_revision_id,workflow_state) VALUES('old-qa','qa',0,1,'draft'); INSERT INTO juyu.revisions(document_id,revision_id,title,body,audience,author_id,editor_id,created_at) VALUES('old-qa',1,'Old question','Old answer','staff','a','a',now()); INSERT INTO juyu.audit_log(document_id,sequence,action,actor_id,revision_id,at) VALUES('old-qa',0,'create','a',1,now()); COMMIT;");
  assert.deepEqual(await migrate(old.pool),['0016_qa','0017_favorites', '0018_recent_views', '0019_analytics', '0020_custom_fields', '0021_categories', '0022_forms', '0023_navigation_settings', '0024_feature_flags', '0025_setting_history', '0026_announcements', '0027_native_editor', '0028_qa_search', '0029_shared_revision_config_locks', '0030_publication_number']);assert.deepEqual((await old.pool.query('SELECT title,body,qa_category,qa_position FROM juyu.revisions')).rows,[{title:'Old question',body:'Old answer',qa_category:'',qa_position:0}]);assert.deepEqual(await migrate(old.pool),[]);
 }finally{await old.close();}
});

test('QA collection inherits parent category audience and disabled status for every reader role',async()=>{
 const publicQa=await publish(await draft('Unrestricted QA','qa'));
 const opsQa=await publish(await draft('Ops parent QA','qa'));
 const adminQa=await publish(await draft('Admin parent QA','qa'));
 const disabledQa=await publish(await draft('Disabled parent QA','qa'));
 const opsParent=randomUUID(),adminParent=randomUUID(),disabledParent=randomUUID();
 const opsChild=randomUUID(),adminChild=randomUUID(),disabledChild=randomUUID();
 await fixture.pool.query("INSERT INTO juyu.categories(id,name,audience,enabled) VALUES($1,'Ops parent','ops',true),($2,'Admin parent','admin',true),($3,'Disabled parent','staff',false)",[opsParent,adminParent,disabledParent]);
 await fixture.pool.query("INSERT INTO juyu.categories(id,name,audience,parent_id,enabled) VALUES($1,'Staff child of Ops','staff',$2,true),($3,'Staff child of Admin','staff',$4,true),($5,'Staff child of disabled parent','staff',$6,true)",[opsChild,opsParent,adminChild,adminParent,disabledChild,disabledParent]);
 for(const [documentId,categoryId] of [[opsQa.id,opsChild],[adminQa.id,adminChild],[disabledQa.id,disabledChild]])await fixture.pool.query('INSERT INTO juyu.revision_categories VALUES($1,1,$2)',[documentId,categoryId]);
 for(const [viewer,allowed] of [[support,[publicQa.id]],[ops,[publicQa.id,opsQa.id]],[admin,[publicQa.id,opsQa.id,adminQa.id]]] as const){
  const page=await collection(viewer);assert.equal(page.total,allowed.length);assert.deepEqual(new Set(page.items.map(item=>item.id)),new Set(allowed));assert.ok(!page.items.some(item=>item.id===disabledQa.id));
 }
 // Disabling a previously allowed ancestor revokes it on the next request,
 // including Admin, while its linked child remains enabled and staff-visible.
 await fixture.pool.query('UPDATE juyu.categories SET enabled=false WHERE id=$1',[opsParent]);
 for(const viewer of [support,ops,admin]){const page=await collection(viewer);assert.ok(!page.items.some(item=>item.id===opsQa.id));assert.equal(page.total,viewer.role==='admin'?2:1);}
});

test('Q&A answer search and inline answers use only current authorized publications',async()=>{
 const id=randomUUID();await service(admin).saveDraft(id,{...input,title:'退款问题',body:answer('OnlyPublishedNeedle')});const d=await publish((await repo.getForManagement(id,admin))!);
 await service(admin).saveDraft(id,{...input,expectedSequence:d.sequence,title:'退款问题',body:answer('DraftOnlyNeedle')});
 await publish(await draft('Hidden','qa','admin','OnlyHiddenNeedle'));
 const article=await publish(await draft('普通文章','article','staff','OnlyPublishedNeedle'));
 assert.equal((await service().qa(1,undefined,'OnlyPublishedNeedle')).total,1);
 assert.equal((await service().qa(1,undefined,'DraftOnlyNeedle')).total,0);
 assert.equal((await service().qa(1,undefined,'OnlyHiddenNeedle')).total,0);
 const result=await service().qaAnswer(id);assert.ok(result.body.includes('OnlyPublishedNeedle'));assert.equal(result.revision,1);
 await assert.rejects(service().qaAnswer(article.id),/FORBIDDEN/);
 const tree=(await service().home()).pages;assert.ok(!JSON.stringify(tree).includes(id));assert.ok(JSON.stringify(tree).includes(article.id));
 assert.ok((await service().reader(id)).destination?.startsWith('/help-centre/qa?question='));
 await fixture.pool.query("UPDATE juyu.members SET disabled_at=now() WHERE clerk_user_id='s'");
 try{await assert.rejects(service().qaAnswer(id),/FORBIDDEN/);}finally{await fixture.pool.query("UPDATE juyu.members SET disabled_at=null WHERE clerk_user_id='s'");}
});
