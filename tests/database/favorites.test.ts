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
before(async()=>{fixture=await temporaryDatabase();await migrate(fixture.pool);await fixture.pool.query("INSERT INTO juyu.members(clerk_user_id,display_name,observed_role,verified_email,observed_at) VALUES('a','Admin','admin','a@example.test',now()),('b','Reviewer','admin','b@example.test',now()),('o','Ops','ops','o@example.test',now()),('s','Support','support','s@example.test',now())");const rp=randomBytes(24).toString('hex'),ip=randomBytes(24).toString('hex');await fixture.pool.query(`CREATE ROLE favorite_runtime LOGIN PASSWORD '${rp}' IN ROLE juyu_runtime; CREATE ROLE favorite_issuer LOGIN PASSWORD '${ip}' IN ROLE juyu_context_issuer`);runtime=fixture.connectAs('favorite_runtime',rp);issuer=fixture.connectAs('favorite_issuer',ip);db=new ScopedDatabase(runtime,issuer);repo=new DocumentRepository(db);});
after(async()=>{await runtime?.end();await issuer?.end();await fixture?.close();});
beforeEach(async()=>{await fixture.pool.query('TRUNCATE juyu.documents CASCADE');});


const collection=(v:Viewer|null=support,page=1)=>db.run(v,async c=>(await import('../../src/server/favorites/repository.ts')).readFavorites(c,page),true);
const get=(id:string,revision=1,v:Viewer|null=support)=>db.run(v,async c=>(await import('../../src/server/favorites/repository.ts')).readFavorite(c,id,revision),true);
const set=(id:string,saved=true,revision=1,v:Viewer|null=support)=>db.run(v,async c=>(await import('../../src/server/favorites/repository.ts')).writeFavorite(c,id,{revision,saved}));
test('personal explicit saves persist independently across requests and duplicate operations preserve order',async()=>{
 const d=await publish(await draft());
 assert.deepEqual(await get(d.id),{documentId:d.id,revision:1,saved:false});
 assert.deepEqual(await set(d.id),{documentId:d.id,revision:1,saved:true});
 const original=await collection();await set(d.id);assert.deepEqual(await collection(),original);
 assert.equal((await get(d.id,1,ops)).saved,false);assert.equal((await collection(admin)).total,0);
 for(const v of [ops,admin])await set(d.id,true,1,v);
 await set(d.id,false);await set(d.id,false);assert.equal((await get(d.id)).saved,false);
 for(const v of [ops,admin])assert.equal((await get(d.id,1,v)).saved,true);
 const db2=new ScopedDatabase(runtime,issuer),device2=new AuthorizationService(db2,async()=>ops);assert.equal((await device2.favorites()).total,1);await device2.saveFavorite(d.id,{revision:1,saved:false});assert.equal((await service(ops).favorite(d.id,1)).saved,false);
 assert.deepEqual(await set('unknown',false),{documentId:'unknown',revision:1,saved:false});
});
test('saved documents follow current formal versions and reject stale adds without exposing drafts',async()=>{
 let d=await publish(await draft('Formal old'));await set(d.id);const old=await collection();
 await service(admin).saveDraft(d.id,{expectedSequence:d.sequence,title:'Private next title',body:encodeEditorBody([{id:'secret',type:'paragraph',content:[{type:'text',text:'Secret draft body',styles:{}}]}]),kind:'reference',audience:'staff',tags:['Next tag'],cover:null});
 assert.deepEqual(await collection(),old);assert.equal((await get(d.id)).saved,true);
 d=await publish((await repo.getForManagement(d.id,admin))!);
 assert.equal((await collection()).items[0].title,'Private next title');assert.equal((await collection()).items[0].revision,2);
 await assert.rejects(set(d.id,true,1),/VERSION_CHANGED/);await assert.rejects(get(d.id,1),/VERSION_CHANGED/);
 assert.equal((await get(d.id,2)).saved,true);await set(d.id,false,1);assert.equal((await get(d.id,2)).saved,false);
});
test('list filters current OPS and category ancestry permissions before counts and pagination',async()=>{
 const ids:string[]=[];
 for(let i=0;i<22;i++){const d=await publish(await draft('Saved '+i,i===0?'qa':'reference'));ids.push(d.id);await set(d.id);}
 await fixture.pool.query("UPDATE juyu.favorites SET created_at='2026-01-01' WHERE member_id='s'");
 const first=await collection(),last=await collection(support,999);assert.equal(first.total,22);assert.equal(first.items.length,20);assert.equal(last.page,2);assert.equal(last.items.length,2);assert.deepEqual([...first.items,...last.items].map(x=>x.id),ids.sort());
 const parent=randomUUID(),child=randomUUID();await fixture.pool.query("INSERT INTO juyu.categories(id,name,audience) VALUES($1,'Parent','admin')",[parent]);await fixture.pool.query("INSERT INTO juyu.categories(id,name,parent_id) VALUES($1,'Child',$2)",[child,parent]);await fixture.pool.query('INSERT INTO juyu.revision_categories VALUES($1,1,$2)',[ids[0],child]);
 assert.equal((await collection()).total,21);await assert.rejects(set(ids[0]),/NOT_FOUND/);await assert.rejects(get(ids[0]),/NOT_FOUND/);
 assert.deepEqual(await set(ids[0],false),{documentId:ids[0],revision:1,saved:false});
 const opsDoc=await publish(await draft('OPS hidden','ops','ops'));await assert.rejects(set(opsDoc.id),/NOT_FOUND/);await set(opsDoc.id,true,1,ops);await set(opsDoc.id,true,1,admin);
 for(const v of [ops,admin])assert.equal((await collection(v)).total,1);
 const raw=(await collection()).items[0];assert.deepEqual(Object.keys(raw).sort(),['id','kind','revision','savedAt','tags','title']);assert.ok(!JSON.stringify(await collection()).includes('Formal body'));
 for(const page of [0,-1,1.1,NaN,2147483648])await assert.rejects(collection(support,page),/INVALID_INPUT/);
 await fixture.pool.query("UPDATE juyu.categories SET audience='staff' WHERE id=$1",[parent]);await set(ids[0]);assert.equal((await collection()).total,22);
 await fixture.pool.query('UPDATE juyu.categories SET enabled=false WHERE id=$1',[parent]);assert.equal((await collection()).total,21);
});
test('both desired states reject absent stale disabled unverified and pending identities',async()=>{
 const d=await publish(await draft());await set(d.id);
 for(const v of [null,{...support,companyVerified:false}]){await assert.rejects(get(d.id,1,v),/FORBIDDEN/);for(const saved of [true,false])await assert.rejects(set(d.id,saved,1,v),/FORBIDDEN/);await assert.rejects(collection(v),/FORBIDDEN/);}
 for(const state of ["disabled_at=now()","observed_role='ops'","verified_email=null","verified_email='   '","observed_at=null"]){await fixture.pool.query(`UPDATE juyu.members SET ${state} WHERE clerk_user_id='s'`);try{for(const saved of [true,false])await assert.rejects(set(d.id,saved),/FORBIDDEN/);await assert.rejects(get(d.id),/FORBIDDEN/);await assert.rejects(collection(),/FORBIDDEN/);}finally{await fixture.pool.query("UPDATE juyu.members SET disabled_at=null,observed_role='support',verified_email='s@example.test',observed_at=now() WHERE clerk_user_id='s'");}}
 await fixture.pool.query("INSERT INTO juyu.member_operations(actor_id,target_id,kind,before_role,requested_role) VALUES('a','s','role','support','ops')");try{for(const saved of [true,false])await assert.rejects(set(d.id,saved),/FORBIDDEN/);await assert.rejects(collection(),/FORBIDDEN/);}finally{await fixture.pool.query("UPDATE juyu.member_operations SET status='conflict',finished_at=now() WHERE target_id='s' AND status='pending'");}
 assert.equal((await get(d.id)).saved,true);
});
test('archive unpublish trash and purge hide saved content and safe removal reveals no existence',async()=>{
 for(const action of ['archive','unpublish','trash','purge'] as const){const d=await publish(await draft(action));await set(d.id);await set(d.id,true,1,ops);
  if(action==='archive'||action==='unpublish')await service(admin).changeAvailability(d.id,{expectedSequence:d.sequence,action});else{await service(admin).lifecycle(d.id,{expectedSequence:d.sequence,action:'trash'});if(action==='purge')await service(admin).lifecycle(d.id,{expectedSequence:d.sequence+1,action:'purge',confirmation:action});}
  assert.equal((await collection()).total,0);await assert.rejects(get(d.id),/NOT_FOUND/);await assert.rejects(set(d.id),/NOT_FOUND/);assert.deepEqual(await set(d.id,false),{documentId:d.id,revision:1,saved:false});
  const n=(await fixture.pool.query("SELECT count(*)::int n FROM juyu.favorites WHERE document_id=$1",[d.id])).rows[0].n;assert.equal(n,action==='purge'?0:1);
 }
});
test('runtime has narrow verified projection and mutations without anonymous ACL or raw favorite DML',async()=>{
 const d=await publish(await draft());await set(d.id);
 await assert.rejects(runtime.query('SELECT * FROM juyu.read_favorite_publications()'),/FORBIDDEN/);await assert.rejects(runtime.query('SELECT * FROM juyu.save_favorite($1,1,false)',[d.id]),/FORBIDDEN/);
 for(const sql of ["INSERT INTO juyu.favorites(member_id,document_id) VALUES('s',$1)","DELETE FROM juyu.favorites WHERE document_id=$1","UPDATE juyu.favorites SET member_id='a' WHERE document_id=$1"])await assert.rejects(db.run(support,c=>c.query(sql,[d.id])),{code:'42501'});
 for(const fn of ['juyu.read_favorite_publications()','juyu.save_favorite(text,integer,boolean)'])assert.equal((await fixture.pool.query("SELECT EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE p.oid=$1::regprocedure AND a.grantee=0 AND a.privilege_type='EXECUTE') ok",[fn])).rows[0].ok,false);
 assert.deepEqual(await db.run(support,async c=>(await c.query('SELECT * FROM juyu.documents')).rows),[]);
 const invalidSqlInputs:(string|number|boolean|null)[][]=[[null,1,false],['',1,true],[' x ',1,false],['x',0,true],['x',1,null]];
 for(const input of invalidSqlInputs)await assert.rejects(db.run(support,c=>c.query('SELECT * FROM juyu.save_favorite($1,$2,$3)',input)),/INVALID_INPUT/);
});

async function waitForLock(pid:number){
 for(let i=0;i<100;i++){
  if((await fixture.pool.query("SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1",[pid])).rows[0]?.wait_event_type==='Lock')return;
  await new Promise(resolve=>setTimeout(resolve,10));
 }
 assert.fail('the second real database session must wait on the held transaction lock');
}
test('concurrent explicit desired writes serialize and the later processed action wins without toggling',async()=>{
 const d=await publish(await draft());const {writeFavorite}=await import('../../src/server/favorites/repository.ts');
 for(const [first,last] of [[true,false],[false,true],[true,true],[false,false]]){
  let release!:()=>void,ready!:()=>void,start!:(pid:number)=>void;
  const gate=new Promise<void>(r=>{release=r;}),written=new Promise<void>(r=>{ready=r;}),started=new Promise<number>(r=>{start=r;});
  const one=db.run(support,async c=>{await writeFavorite(c,d.id,{revision:1,saved:first});ready();await gate;});
  await written;
  const two=db.run(support,async c=>{start((await c.query('SELECT pg_backend_pid() pid')).rows[0].pid);return writeFavorite(c,d.id,{revision:1,saved:last});});
  try{await waitForLock(await started);}finally{release();}
  await one;assert.equal((await two).saved,last);assert.equal((await get(d.id)).saved,last);
 }
});
test('add rechecks the formal publication after a concurrent availability change commits',async()=>{
 const d=await publish(await draft());let release!:()=>void,ready!:()=>void,start!:(pid:number)=>void;
 const gate=new Promise<void>(r=>{release=r;}),changed=new Promise<void>(r=>{ready=r;}),started=new Promise<number>(r=>{start=r;});
 const archive=db.run(admin,async c=>{await c.query("SELECT * FROM juyu.change_document_availability($1,'archive',$2)",[d.id,d.sequence]);ready();await gate;});
 await changed;
 const save=db.run(support,async c=>{start((await c.query('SELECT pg_backend_pid() pid')).rows[0].pid);return (await import('../../src/server/favorites/repository.ts')).writeFavorite(c,d.id,{revision:1,saved:true});}).then(value=>({value}),error=>({error}));
 try{await waitForLock(await started);}finally{release();}
 await archive;assert.match(String((await save as {error:Error}).error),/NOT_FOUND/);assert.equal((await collection()).total,0);
});
test('identity mutations serialize and a member disabled while add waits cannot save',async()=>{
 const d=await publish(await draft());const owner=await fixture.pool.connect();let start!:(pid:number)=>void;const started=new Promise<number>(r=>{start=r;});
 try{
  await owner.query('BEGIN');await owner.query("UPDATE juyu.members SET disabled_at=now() WHERE clerk_user_id='s'");
  const save=db.run(support,async c=>{start((await c.query('SELECT pg_backend_pid() pid')).rows[0].pid);return (await import('../../src/server/favorites/repository.ts')).writeFavorite(c,d.id,{revision:1,saved:true});}).then(value=>({value}),error=>({error}));
  await waitForLock(await started);await owner.query('COMMIT');assert.match(String((await save as {error:Error}).error),/FORBIDDEN/);
 }finally{await owner.query('ROLLBACK');owner.release();await fixture.pool.query("UPDATE juyu.members SET disabled_at=null WHERE clerk_user_id='s'");}
 assert.equal((await get(d.id)).saved,false);
 const lock=await fixture.pool.connect();try{await lock.query('BEGIN');await lock.query('SELECT pg_advisory_xact_lock(84620915)');for(const saved of [true,false])await assert.rejects(set(d.id,saved),/MEMBER_BUSY/);}finally{await lock.query('ROLLBACK');lock.release();}
});
test('restored access resurfaces retained links while enrollment pending blocks all personal operations',async()=>{
 const d=await publish(await draft());await set(d.id);const original=await collection();
 const cat=randomUUID();await fixture.pool.query("INSERT INTO juyu.categories(id,name,audience) VALUES($1,'Temporary restriction','admin')",[cat]);await fixture.pool.query('INSERT INTO juyu.revision_categories VALUES($1,1,$2)',[d.id,cat]);assert.equal((await collection()).total,0);
 await fixture.pool.query("UPDATE juyu.categories SET audience='staff' WHERE id=$1",[cat]);assert.deepEqual(await collection(),original);
 await fixture.pool.query("INSERT INTO juyu.role_enrollments(member_id,requested_role,purpose) VALUES('s','support','default')");try{await assert.rejects(collection(),/FORBIDDEN/);await assert.rejects(get(d.id),/FORBIDDEN/);for(const saved of [true,false])await assert.rejects(set(d.id,saved),/FORBIDDEN/);}finally{await fixture.pool.query("UPDATE juyu.role_enrollments SET state='complete',confirmed_at=now() WHERE member_id='s'");}
 assert.deepEqual(await collection(),original);
});
test('even malformed legacy OPS staff audience cannot disclose saved titles or counts to Support',async()=>{
 const d=await publish(await draft('OPS restricted','ops','ops'));
 const owner=await fixture.pool.connect();try{await owner.query('BEGIN');await owner.query('ALTER TABLE juyu.revisions DISABLE TRIGGER immutable_revision');await owner.query("UPDATE juyu.revisions SET audience='staff' WHERE document_id=$1",[d.id]);await owner.query('ALTER TABLE juyu.revisions ENABLE TRIGGER immutable_revision');await owner.query("INSERT INTO juyu.favorites(member_id,document_id) VALUES('s',$1)",[d.id]);await owner.query('COMMIT');}catch(error){await owner.query('ROLLBACK');throw error;}finally{owner.release();}
 assert.deepEqual(await collection(),{items:[],total:0,page:1,pages:1});await assert.rejects(get(d.id),/NOT_FOUND/);await assert.rejects(set(d.id),/NOT_FOUND/);assert.deepEqual(await set(d.id,false),{documentId:d.id,revision:1,saved:false});
});
test('favorites migration preserves existing personal links and is replay safe',async()=>{
 const old=await temporaryDatabase();try{
  await old.pool.query('CREATE SCHEMA juyu; CREATE TABLE juyu.schema_migrations(version text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
  const directory=new URL('../../src/server/database/migrations/',import.meta.url);
  for(const file of (await readdir(directory)).filter(file=>file.endsWith('.sql')&&file<'0017').sort()){
   const sql=await readFile(new URL(file,directory),'utf8');await old.pool.query(sql);await old.pool.query('INSERT INTO juyu.schema_migrations(version,checksum) VALUES($1,$2)',[file.slice(0,-4),createHash('sha256').update(sql).digest('hex')]);
  }
  await old.pool.query("BEGIN; INSERT INTO juyu.members(clerk_user_id,display_name) VALUES('a','Admin'); INSERT INTO juyu.documents(id,kind,sequence,workflow_revision_id,workflow_state) VALUES('old-favorite','article',0,1,'draft'); INSERT INTO juyu.revisions(document_id,revision_id,title,body,audience,author_id,editor_id,created_at) VALUES('old-favorite',1,'Old title','Old body','staff','a','a',now()); INSERT INTO juyu.audit_log(document_id,sequence,action,actor_id,revision_id,at) VALUES('old-favorite',0,'create','a',1,now()); INSERT INTO juyu.favorites VALUES('a','old-favorite','2025-01-01'); COMMIT;");
  const before=(await old.pool.query('SELECT * FROM juyu.favorites')).rows;assert.deepEqual(await migrate(old.pool),['0017_favorites', '0018_recent_views', '0019_analytics', '0020_custom_fields', '0021_categories', '0022_forms', '0023_navigation_settings', '0024_feature_flags', '0025_setting_history', '0026_announcements', '0027_native_editor', '0028_qa_search', '0029_shared_revision_config_locks', '0030_publication_number']);assert.deepEqual((await old.pool.query('SELECT * FROM juyu.favorites')).rows,before);assert.deepEqual(await migrate(old.pool),[]);
 }finally{await old.close();}
});
