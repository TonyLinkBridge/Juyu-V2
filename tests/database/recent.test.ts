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
before(async()=>{fixture=await temporaryDatabase();await migrate(fixture.pool);await fixture.pool.query("INSERT INTO juyu.members(clerk_user_id,display_name,observed_role,verified_email,observed_at) VALUES('a','Admin','admin','a@example.test',now()),('b','Reviewer','admin','b@example.test',now()),('o','Ops','ops','o@example.test',now()),('s','Support','support','s@example.test',now())");const rp=randomBytes(24).toString('hex'),ip=randomBytes(24).toString('hex');await fixture.pool.query(`CREATE ROLE recent_runtime LOGIN PASSWORD '${rp}' IN ROLE juyu_runtime; CREATE ROLE recent_issuer LOGIN PASSWORD '${ip}' IN ROLE juyu_context_issuer`);runtime=fixture.connectAs('recent_runtime',rp);issuer=fixture.connectAs('recent_issuer',ip);db=new ScopedDatabase(runtime,issuer);repo=new DocumentRepository(db);});
after(async()=>{await runtime?.end();await issuer?.end();await fixture?.close();});
beforeEach(async()=>{await fixture.pool.query('TRUNCATE juyu.documents CASCADE');});



const collection=(v:Viewer|null=support,page=1)=>db.run(v,async c=>(await import('../../src/server/recent/repository.ts')).readRecent(c,page),true);
const record=(id:string,revision=1,v:Viewer|null=support)=>db.run(v,async c=>(await import('../../src/server/recent/repository.ts')).recordRecent(c,id,{revision}));
test('actual opens persist across services, duplicate visits update time, and collection reads never write',async()=>{
 const d=await publish(await draft());assert.equal((await collection()).total,0);
 const before=Date.now(),receipt=await record(d.id),after=Date.now();assert.equal(receipt.documentId,d.id);assert.equal(receipt.revision,1);assert.ok(Date.parse(receipt.viewedAt)>=before&&Date.parse(receipt.viewedAt)<=after);
 const first=await collection();assert.equal(first.total,1);assert.equal(first.items[0].viewedRevision,1);assert.equal(first.items[0].viewedAt,receipt.viewedAt);assert.deepEqual(await collection(),first);
 const again=await record(d.id);assert.ok(again.viewedAt>receipt.viewedAt);assert.equal((await collection()).total,1);
 assert.equal((await collection(ops)).total,0);await record(d.id,1,ops);assert.equal((await collection(admin)).total,0);
 const db2=new ScopedDatabase(runtime,issuer);assert.equal((await db2.run(support,async c=>(await import('../../src/server/recent/repository.ts')).readRecent(c),true)).total,1);
 assert.deepEqual(Object.keys((await collection()).items[0]).sort(),['id','kind','revision','tags','title','viewedAt','viewedRevision']);
});
test('current publication metadata replaces historical metadata without pretending the newer revision was viewed',async()=>{
 let d=await publish(await draft('Old formal'));await record(d.id);const first=await collection();
 await service(admin).saveDraft(d.id,{expectedSequence:d.sequence,title:'New formal',body:encodeEditorBody([{id:'secret',type:'paragraph',content:[{type:'text',text:'Secret body',styles:{}}]}]),kind:'reference',audience:'staff',tags:['New tag'],cover:null});
 assert.deepEqual(await collection(),first);d=await publish((await repo.getForManagement(d.id,admin))!);
 const item=(await collection()).items[0];assert.equal(item.title,'New formal');assert.deepEqual(item.tags,['New tag']);assert.equal(item.revision,2);assert.equal(item.viewedRevision,1);assert.equal(item.viewedAt,first.items[0].viewedAt);
 await assert.rejects(record(d.id),/VERSION_CHANGED/);await record(d.id,2);assert.equal((await collection()).items[0].viewedRevision,2);
});
test('permissions filter OPS, category ancestry, counts and pagination before data leaves the database',async()=>{
 const ids:string[]=[];for(let i=0;i<22;i++){const d=await publish(await draft('Recent '+i,i===0?'qa':'reference'));ids.push(d.id);await record(d.id);}
 await fixture.pool.query("UPDATE juyu.recent_views SET viewed_at='2026-01-01' WHERE member_id='s'");
 const first=await collection(),last=await collection(support,999);assert.equal(first.total,22);assert.equal(first.items.length,20);assert.equal(last.page,2);assert.equal(last.items.length,2);assert.deepEqual([...first.items,...last.items].map(x=>x.id),ids.sort());
 const parent=randomUUID(),child=randomUUID();await fixture.pool.query("INSERT INTO juyu.categories(id,name,audience) VALUES($1,'Parent','admin')",[parent]);await fixture.pool.query("INSERT INTO juyu.categories(id,name,parent_id) VALUES($1,'Child',$2)",[child,parent]);await fixture.pool.query('INSERT INTO juyu.revision_categories VALUES($1,1,$2)',[ids[0],child]);assert.equal((await collection()).total,21);await assert.rejects(record(ids[0]),/NOT_FOUND/);
 await fixture.pool.query("UPDATE juyu.categories SET audience='staff' WHERE id=$1",[parent]);assert.equal((await collection()).total,22);await fixture.pool.query('UPDATE juyu.categories SET enabled=false WHERE id=$1',[parent]);assert.equal((await collection()).total,21);
 const d=await publish(await draft('OPS hidden','ops','ops'));await assert.rejects(record(d.id),/NOT_FOUND/);for(const v of [ops,admin]){await record(d.id,1,v);assert.equal((await collection(v)).total,1);}
 for(const page of [0,-1,1.1,NaN,2147483648])await assert.rejects(collection(support,page),/INVALID_INPUT/);
});
test('list and writes reject stale, disabled, unverified and pending identities while retaining personal rows',async()=>{
 const d=await publish(await draft());await record(d.id);
 for(const v of [null,{...support,companyVerified:false}]){await assert.rejects(record(d.id,1,v),/FORBIDDEN/);await assert.rejects(collection(v),/FORBIDDEN/);}
 for(const state of ["disabled_at=now()","observed_role='ops'","verified_email=null","verified_email='   '","observed_at=null"]){await fixture.pool.query(`UPDATE juyu.members SET ${state} WHERE clerk_user_id='s'`);try{await assert.rejects(record(d.id),/FORBIDDEN/);await assert.rejects(collection(),/FORBIDDEN/);}finally{await fixture.pool.query("UPDATE juyu.members SET disabled_at=null,observed_role='support',verified_email='s@example.test',observed_at=now() WHERE clerk_user_id='s'");}}
 await fixture.pool.query("INSERT INTO juyu.member_operations(actor_id,target_id,kind,before_role,requested_role) VALUES('a','s','role','support','ops')");try{await assert.rejects(record(d.id),/FORBIDDEN/);await assert.rejects(collection(),/FORBIDDEN/);}finally{await fixture.pool.query("UPDATE juyu.member_operations SET status='conflict',finished_at=now() WHERE target_id='s' AND status='pending'");}
 await fixture.pool.query("INSERT INTO juyu.role_enrollments(member_id,requested_role,purpose) VALUES('s','support','default')");try{await assert.rejects(record(d.id),/FORBIDDEN/);await assert.rejects(collection(),/FORBIDDEN/);}finally{await fixture.pool.query("UPDATE juyu.role_enrollments SET state='complete',confirmed_at=now() WHERE member_id='s'");}
 assert.equal((await collection()).total,1);
});
test('archive unpublish trash hide history and purge removes its rows for every member',async()=>{
 for(const action of ['archive','unpublish','trash','purge'] as const){const d=await publish(await draft(action));await record(d.id);await record(d.id,1,ops);
  if(action==='archive'||action==='unpublish')await service(admin).changeAvailability(d.id,{expectedSequence:d.sequence,action});else{await service(admin).lifecycle(d.id,{expectedSequence:d.sequence,action:'trash'});if(action==='purge')await service(admin).lifecycle(d.id,{expectedSequence:d.sequence+1,action:'purge',confirmation:action});}
  assert.equal((await collection()).total,0);await assert.rejects(record(d.id),/NOT_FOUND/);const n=(await fixture.pool.query('SELECT count(*)::int n FROM juyu.recent_views WHERE document_id=$1',[d.id])).rows[0].n;assert.equal(n,action==='purge'?0:2);
 }
});
test('runtime cannot forge actors, timestamps, raw writes, anonymous calls or security-definer configuration',async()=>{
 const d=await publish(await draft());await record(d.id);
 await assert.rejects(runtime.query('SELECT * FROM juyu.read_recent_publications()'),/FORBIDDEN/);await assert.rejects(runtime.query('SELECT * FROM juyu.record_recent_view($1,1)',[d.id]),/FORBIDDEN/);
 for(const sql of ["INSERT INTO juyu.recent_views(member_id,document_id,revision_id) VALUES('s',$1,1)","DELETE FROM juyu.recent_views WHERE document_id=$1","UPDATE juyu.recent_views SET member_id='a' WHERE document_id=$1"])await assert.rejects(db.run(support,c=>c.query(sql,[d.id])),{code:'42501'});
 for(const fn of ['juyu.read_recent_publications()','juyu.record_recent_view(text,integer)']){const p=(await fixture.pool.query('SELECT prosecdef,proconfig,EXISTS(SELECT 1 FROM aclexplode(proacl) a WHERE a.grantee=0 AND a.privilege_type=\'EXECUTE\') public_execute FROM pg_proc WHERE oid=$1::regprocedure',[fn])).rows[0];assert.equal(p.prosecdef,true);assert.deepEqual(p.proconfig,['search_path=pg_catalog, juyu']);assert.equal(p.public_execute,false);}
 const invalidSqlInputs:(string|number|null)[][]=[[null,1],['',1],[' x ',1],['x',0],['x',null]];
 for(const input of invalidSqlInputs)await assert.rejects(db.run(support,c=>c.query('SELECT * FROM juyu.record_recent_view($1,$2)',input)),/INVALID_INPUT/);
 for(const input of [{revision:1,viewedAt:'2030-01-01'},{revision:1,memberId:'a'}])await assert.rejects(db.run(support,async c=>(await import('../../src/server/recent/repository.ts')).recordRecent(c,d.id,input)),/INVALID_INPUT/);
});
async function waitForLock(pid:number){for(let i=0;i<100;i++){if((await fixture.pool.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0]?.wait_event_type==='Lock')return;await new Promise(resolve=>setTimeout(resolve,10));}assert.fail('real database session must wait for transaction lock');}
test('retention keeps the newest 100 unique documents, including concurrent opens of different documents',async()=>{
 const ids:string[]=[];for(let i=0;i<101;i++){const d=await publish(await draft('Retention '+i));ids.push(d.id);await record(d.id);}
 assert.equal((await collection()).total,100);assert.equal((await fixture.pool.query("SELECT count(*)::int n FROM juyu.recent_views WHERE member_id='s' AND document_id=$1",[ids[0]])).rows[0].n,0);
 const {recordRecent}=await import('../../src/server/recent/repository.ts');let release!:()=>void,ready!:()=>void,start!:(pid:number)=>void;const gate=new Promise<void>(r=>{release=r;}),written=new Promise<void>(r=>{ready=r;}),started=new Promise<number>(r=>{start=r;});
 const one=db.run(support,async c=>{const receipt=await recordRecent(c,ids[0],{revision:1});ready();await gate;return receipt;});await written;
 const two=db.run(support,async c=>{start((await c.query('SELECT pg_backend_pid() pid')).rows[0].pid);return recordRecent(c,ids[1],{revision:1});});try{await waitForLock(await started);}finally{release();}const a=await one,b=await two;assert.ok(b.viewedAt>a.viewedAt);assert.equal((await collection()).total,100);assert.deepEqual((await collection()).items.slice(0,2).map(x=>x.id),[ids[1],ids[0]]);
 assert.equal((await fixture.pool.query("SELECT count(*)::int n FROM juyu.recent_views WHERE member_id='s'")).rows[0].n,100);await record(ids[2],1,ops);assert.equal((await collection(ops)).total,1);
 // A purge holding a recent row must complete while another document's visit trims that row.
 const victim=(await repo.getForManagement(ids[3],admin))!;await service(admin).lifecycle(victim.id,{expectedSequence:victim.sequence,action:'trash'});
 let releasePurge!:()=>void,purged!:()=>void,startVisit!:(pid:number)=>void;const purgeGate=new Promise<void>(r=>{releasePurge=r;}),deleted=new Promise<void>(r=>{purged=r;}),visitStarted=new Promise<number>(r=>{startVisit=r;});
 const purge=db.run(admin,async c=>{await c.query("SELECT * FROM juyu.change_document_lifecycle($1,'purge',$2,$3)",[victim.id,victim.sequence+1,'Retention 3']);purged();await purgeGate;});await deleted;
 const visit=db.run(support,async c=>{startVisit((await c.query('SELECT pg_backend_pid() pid')).rows[0].pid);return recordRecent(c,ids[2],{revision:1});});try{await waitForLock(await visitStarted);}finally{releasePurge();}await purge;await visit;assert.equal((await collection()).total,100);

});
test('waiting writers recheck a newly archived document and a newly disabled member',async()=>{
 const d=await publish(await draft());
 for(const change of ['document','member']){const owner=await fixture.pool.connect();let start!:(pid:number)=>void;const started=new Promise<number>(r=>{start=r;});try{await owner.query('BEGIN');if(change==='document')await owner.query("UPDATE juyu.documents SET lifecycle='archived' WHERE id=$1",[d.id]);else await owner.query("UPDATE juyu.members SET disabled_at=now() WHERE clerk_user_id='s'");const result=db.run(support,async c=>{start((await c.query('SELECT pg_backend_pid() pid')).rows[0].pid);return (await import('../../src/server/recent/repository.ts')).recordRecent(c,d.id,{revision:1});}).then(value=>({value}),error=>({error}));await waitForLock(await started);await owner.query('COMMIT');assert.match(String((await result as {error:Error}).error),change==='document'?/NOT_FOUND/:/FORBIDDEN/);}finally{await owner.query('ROLLBACK');owner.release();if(change==='document')await fixture.pool.query("UPDATE juyu.documents SET lifecycle='active' WHERE id=$1",[d.id]);else await fixture.pool.query("UPDATE juyu.members SET disabled_at=null WHERE clerk_user_id='s'");}}
 assert.equal((await collection()).total,0);const lock=await fixture.pool.connect();try{await lock.query('BEGIN');await lock.query('SELECT pg_advisory_xact_lock(84620915)');await assert.rejects(record(d.id),/MEMBER_BUSY/);}finally{await lock.query('ROLLBACK');lock.release();}
});
test('malformed legacy OPS staff audience cannot disclose stored recent titles or counts to support',async()=>{
 const d=await publish(await draft('Hidden OPS','ops','ops'));const owner=await fixture.pool.connect();try{await owner.query('BEGIN');await owner.query('ALTER TABLE juyu.revisions DISABLE TRIGGER immutable_revision');await owner.query("UPDATE juyu.revisions SET audience='staff' WHERE document_id=$1",[d.id]);await owner.query('ALTER TABLE juyu.revisions ENABLE TRIGGER immutable_revision');await owner.query("INSERT INTO juyu.recent_views(member_id,document_id,revision_id) VALUES('s',$1,1)",[d.id]);await owner.query('COMMIT');}catch(error){await owner.query('ROLLBACK');throw error;}finally{owner.release();}assert.deepEqual(await collection(),{items:[],total:0,page:1,pages:1});await assert.rejects(record(d.id),/NOT_FOUND/);
});
test('migration trims legacy history by newest time then id and leaves other personal data untouched',async()=>{
 const old=await temporaryDatabase();try{await old.pool.query('CREATE SCHEMA juyu; CREATE TABLE juyu.schema_migrations(version text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');const directory=new URL('../../src/server/database/migrations/',import.meta.url);for(const file of (await readdir(directory)).filter(file=>file.endsWith('.sql')&&file<'0018').sort()){const sql=await readFile(new URL(file,directory),'utf8');await old.pool.query(sql);await old.pool.query('INSERT INTO juyu.schema_migrations(version,checksum) VALUES($1,$2)',[file.slice(0,-4),createHash('sha256').update(sql).digest('hex')]);}
 await old.pool.query("BEGIN; INSERT INTO juyu.members(clerk_user_id,display_name) VALUES('a','Admin'),('s','Support'); INSERT INTO juyu.documents(id,kind,sequence,workflow_revision_id,workflow_state) SELECT 'old-'||lpad(i::text,3,'0'),'article',0,1,'draft' FROM generate_series(1,103) i; INSERT INTO juyu.revisions(document_id,revision_id,title,body,audience,author_id,editor_id,created_at) SELECT id,1,'Old title','Old body','staff','a','a',now() FROM juyu.documents; INSERT INTO juyu.audit_log(document_id,sequence,action,actor_id,revision_id,at) SELECT id,0,'create','a',1,now() FROM juyu.documents; INSERT INTO juyu.recent_views SELECT 'a',id,1,'2025-01-01' FROM juyu.documents; INSERT INTO juyu.recent_views VALUES('s','old-103',1,'2020-01-01'); UPDATE juyu.recent_views SET viewed_at='2026-01-01' WHERE member_id='a' AND document_id='old-103'; INSERT INTO juyu.favorites VALUES('a','old-103','2025-01-01'); COMMIT;");
 const before=(await old.pool.query('SELECT * FROM juyu.favorites')).rows;assert.deepEqual(await migrate(old.pool),['0018_recent_views', '0019_analytics', '0020_custom_fields', '0021_categories', '0022_forms', '0023_navigation_settings', '0024_feature_flags', '0025_setting_history', '0026_announcements', '0027_native_editor', '0028_qa_search', '0029_shared_revision_config_locks', '0030_publication_number']);assert.deepEqual((await old.pool.query('SELECT * FROM juyu.favorites')).rows,before);const rows=(await old.pool.query("SELECT document_id FROM juyu.recent_views WHERE member_id='a' ORDER BY viewed_at DESC,document_id COLLATE \"C\"")).rows;assert.equal(rows.length,100);assert.equal(rows[0].document_id,'old-103');assert.equal(rows[99].document_id,'old-099');assert.equal((await old.pool.query("SELECT count(*)::int n FROM juyu.recent_views WHERE member_id='s'")).rows[0].n,1);assert.deepEqual(await migrate(old.pool),[]);
 }finally{await old.close();}
});

test('a competing same-document open waits then returns the last server-processed timestamp',async()=>{
 const d=await publish(await draft());const {recordRecent}=await import('../../src/server/recent/repository.ts');let release!:()=>void,ready!:()=>void,start!:(pid:number)=>void;const gate=new Promise<void>(r=>{release=r;}),written=new Promise<void>(r=>{ready=r;}),started=new Promise<number>(r=>{start=r;});const one=db.run(support,async c=>{const receipt=await recordRecent(c,d.id,{revision:1});ready();await gate;return receipt;});await written;const two=db.run(support,async c=>{start((await c.query('SELECT pg_backend_pid() pid')).rows[0].pid);return recordRecent(c,d.id,{revision:1});});try{await waitForLock(await started);}finally{release();}const first=await one,last=await two;assert.ok(last.viewedAt>first.viewedAt);assert.equal((await collection()).total,1);assert.equal((await collection()).items[0].viewedAt,last.viewedAt);
});
test('list count and page access share a read-only snapshot during concurrent archive',async()=>{
 const d=await publish(await draft());await record(d.id);const {readRecent}=await import('../../src/server/recent/repository.ts');await db.run(support,async c=>{const before=await readRecent(c);await service(admin).changeAvailability(d.id,{expectedSequence:d.sequence,action:'archive'});assert.deepEqual(await readRecent(c),before);},true);assert.equal((await collection()).total,0);
});
test('an open waiting for a newly published revision rejects its stale displayed revision without recording',async()=>{
 const d=await publish(await draft());await service(admin).saveDraft(d.id,{expectedSequence:d.sequence,title:'Second formal',body:encodeEditorBody([]),kind:'reference',audience:'staff',tags:[],cover:null});
 const next=(await repo.getForManagement(d.id,admin))!;await service(admin).submitReview(d.id,{expectedSequence:next.sequence,reviewerId:'b'});await service(reviewer).decideReview(d.id,{expectedSequence:next.sequence+1,action:'approve'});await service(admin).changePublication(d.id,{expectedSequence:next.sequence+2,action:'queue'});
 let release!:()=>void,ready!:()=>void,start!:(pid:number)=>void;const gate=new Promise<void>(r=>{release=r;}),published=new Promise<void>(r=>{ready=r;}),started=new Promise<number>(r=>{start=r;});
 const publication=db.run(admin,async c=>{await (await import('../../src/server/review/publication.ts')).changeSavedPublication(c,d.id,{expectedSequence:next.sequence+3,action:'publish'},admin);ready();await gate;});await published;
 const visit=db.run(support,async c=>{start((await c.query('SELECT pg_backend_pid() pid')).rows[0].pid);return (await import('../../src/server/recent/repository.ts')).recordRecent(c,d.id,{revision:1});}).then(value=>({value}),error=>({error}));try{await waitForLock(await started);}finally{release();}await publication;assert.match(String((await visit as {error:Error}).error),/VERSION_CHANGED/);assert.equal((await collection()).total,0);await record(d.id,2);assert.equal((await collection()).items[0].viewedRevision,2);
});
