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
import {readFieldDefinitions,writeFieldDefinition} from '../../src/server/fields/repository.ts';
import {prepareFieldSnapshots} from '../../src/fields/model.ts';
import type {FieldWrite} from '../../src/fields/model.ts';
import type {Viewer,Document} from '../../src/domain/model.ts';
let fixture:Awaited<ReturnType<typeof temporaryDatabase>>,runtime:Pool,issuer:Pool,db:ScopedDatabase,repo:DocumentRepository;
const admin:Viewer={id:'a',role:'admin',companyVerified:true},reviewer:Viewer={...admin,id:'b'},support:Viewer={id:'s',role:'support',companyVerified:true},ops:Viewer={id:'o',role:'ops',companyVerified:true};
const service=(v:Viewer=admin)=>new AuthorizationService(db,async()=>v);
const config:FieldWrite={expectedVersion:null,name:'工单类型',type:'select',options:['付款','退款'],enabled:true,required:true};
const write=(id:string,value:FieldWrite=config,v=admin)=>db.run(v,c=>writeFieldDefinition(c,id,value));
const read=(v=admin)=>db.run(v,c=>readFieldDefinitions(c),true);
const input={expectedSequence:null,title:'字段文章',body:encodeEditorBody([{id:'p',type:'paragraph',content:[{type:'text',text:'正文',styles:{}}]}]),kind:'article',audience:'staff',tags:[],cover:null};
async function publish(d:Document){await service().submitReview(d.id,{expectedSequence:d.sequence,reviewerId:'b'});await service(reviewer).decideReview(d.id,{expectedSequence:d.sequence+1,action:'approve'});await service().changePublication(d.id,{expectedSequence:d.sequence+2,action:'queue'});await service().changePublication(d.id,{expectedSequence:d.sequence+3,action:'publish'});return (await repo.getForManagement(d.id,admin))!;}
before(async()=>{fixture=await temporaryDatabase();await migrate(fixture.pool);await fixture.pool.query("INSERT INTO juyu.members(clerk_user_id,display_name,observed_role,verified_email,observed_at) VALUES('a','Admin','admin','a@example.test',now()),('b','Reviewer','admin','b@example.test',now()),('s','Support','support','s@example.test',now()),('o','Ops','ops','o@example.test',now())");const rp=randomBytes(24).toString('hex'),ip=randomBytes(24).toString('hex');await fixture.pool.query(`CREATE ROLE fields_runtime LOGIN PASSWORD '${rp}' IN ROLE juyu_runtime; CREATE ROLE fields_issuer LOGIN PASSWORD '${ip}' IN ROLE juyu_context_issuer`);runtime=fixture.connectAs('fields_runtime',rp);issuer=fixture.connectAs('fields_issuer',ip);db=new ScopedDatabase(runtime,issuer);repo=new DocumentRepository(db);});
after(async()=>{await runtime?.end();await issuer?.end();await fixture?.close();});
beforeEach(async()=>{await fixture.pool.query('TRUNCATE juyu.documents,juyu.settings CASCADE');});
test('field settings enforce versioned exact retries immutable type and current admin identity',async()=>{
 const id=randomUUID(),d=await write(id);const {expectedVersion,...rest}=config;assert.equal(expectedVersion,null);assert.deepEqual(d,{id,version:1,...rest});
 assert.deepEqual(await read(),[d]);assert.deepEqual(await write(id),d);
 await assert.rejects(write(id,{...config,name:'Changed'}),/FIELD_CONFLICT/);await assert.rejects(write(id,config,reviewer),/FIELD_CONFLICT/);
 const changed=await write(id,{...config,expectedVersion:1,name:'New'});assert.equal(changed.version,2);assert.deepEqual(await write(id,{...config,expectedVersion:1,name:'New'}),changed);
 await assert.rejects(write(id,{...config,expectedVersion:2,type:'text',options:[]}),/INVALID_INPUT/);
 assert.equal((await fixture.pool.query('SELECT count(*)::int AS n FROM juyu.setting_versions')).rows[0].n,2);
 for(const v of [support,ops]){await assert.rejects(read(v),/FORBIDDEN/);await assert.rejects(write(randomUUID(),config,v),/FORBIDDEN/);}
 await assert.rejects(runtime.query('SELECT juyu.read_field_definitions()'),/FORBIDDEN/);
 await assert.rejects(db.run(admin,c=>c.query("UPDATE juyu.settings SET enabled=false WHERE id=$1",[id])),/permission denied/);
 await assert.rejects(fixture.pool.query("UPDATE juyu.setting_versions SET config='{}' WHERE setting_id=$1",[id]),/IMMUTABLE/);
 for(const state of ["disabled_at=now()","observed_role='ops'","verified_email=null","observed_at=null"]){await fixture.pool.query(`UPDATE juyu.members SET ${state} WHERE clerk_user_id='a'`);try{await assert.rejects(read(),/FORBIDDEN/);await assert.rejects(write(randomUUID()),/FORBIDDEN/);}finally{await fixture.pool.query("UPDATE juyu.members SET disabled_at=null,observed_role='admin',verified_email='a@example.test',observed_at=now() WHERE clerk_user_id='a'");}}
});
test('field saves validate exact latest definitions and preserve formal review historical restore and inactive snapshots',async()=>{
 const field=await write(randomUUID());const snapshots=[{...field,value:'付款'}];const id=randomUUID();
 for(const customFields of [undefined,[],[{...field,value:'错误'}],[{...field,value:null}],[{...field,name:'伪造',value:'付款'}]])await assert.rejects(repo.saveEditor(id,{...input,...(customFields===undefined?{}:{customFields})},admin),/INVALID_INPUT/);
 await assert.rejects(repo.create({id:randomUUID(),title:'Bypass',body:'body',audience:'staff',kind:'article'},admin),/INVALID_INPUT/);
 const saved=await repo.saveEditor(id,{...input,customFields:snapshots},admin);assert.deepEqual(saved.customFields,snapshots);assert.deepEqual(saved.fieldDefinitions,[field]);
 assert.deepEqual(await repo.saveEditor(id,{...input,customFields:snapshots},admin),saved);let d=await publish((await repo.getForManagement(id,admin))!);
 const changed=await write(field.id,{...config,expectedVersion:1,name:'新标签',options:['新选项']});
 assert.deepEqual((await service().historyVersion(id,1)).version.customFields,snapshots);
 const next=[{...changed,value:'新选项'}];await assert.rejects(repo.saveEditor(id,{...input,expectedSequence:d.sequence,customFields:snapshots},admin),/FIELD_CONFLICT/);
 await repo.saveEditor(id,{...input,expectedSequence:d.sequence,customFields:next},admin);assert.deepEqual((await repo.getForManagement(id,admin))!.revisions[0].customFields,snapshots);
 d=(await repo.getForManagement(id,admin))!;await service().submitReview(id,{expectedSequence:d.sequence,reviewerId:'b'});assert.deepEqual((await service(reviewer).reviewDetail(id)).article.customFields,next);
 await service(reviewer).decideReview(id,{expectedSequence:d.sequence+1,action:'reject',reason:'修正'});
 d=(await repo.getForManagement(id,admin))!;await service().restoreVersion(id,{expectedSequence:d.sequence,sourceRevision:1});assert.deepEqual((await repo.getEditor(id,admin)).customFields,snapshots);assert.equal((await repo.getForManagement(id,admin))!.publishedRevisionId,1);
 const disabled=await write(field.id,{...config,expectedVersion:2,name:'新标签',options:['新选项'],enabled:false});
 const editor=await repo.getEditor(id,admin);assert.deepEqual(prepareFieldSnapshots([disabled],editor.customFields),snapshots);
 for(const customFields of [[],[{...snapshots[0],value:null}]])await assert.rejects(repo.saveEditor(id,{...input,expectedSequence:editor.sequence,customFields},admin),/INVALID_INPUT/);
 await repo.saveEditor(id,{...input,expectedSequence:editor.sequence,customFields:snapshots},admin);
 await assert.rejects(fixture.pool.query('UPDATE juyu.revisions SET custom_fields=\'[]\' WHERE document_id=$1',[id]),/IMMUTABLE/);
});
test('field limit and simultaneous exact retries are serialized with immutable audit',async()=>{
 const id=randomUUID();const attempts=await Promise.all([write(id),write(id)]);assert.deepEqual(attempts[0],attempts[1]);
 for(let n=1;n<29;n++)await write(randomUUID(),{...config,enabled:false});
 const results=await Promise.allSettled([write(randomUUID()),write(randomUUID())]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.match(String((results.find(r=>r.status==='rejected') as PromiseRejectedResult).reason),/FIELD_LIMIT/);assert.equal((await read()).length,30);
 assert.equal((await fixture.pool.query('SELECT count(*)::int n FROM juyu.setting_versions')).rows[0].n,30);
});
test('pending membership and enrollment cannot read or mutate field configuration',async()=>{
 const op=(await fixture.pool.query("INSERT INTO juyu.member_operations(actor_id,target_id,kind,requested_role) VALUES('b','a','role','support') RETURNING id")).rows[0].id;
 try{await assert.rejects(read(),/FORBIDDEN/);await assert.rejects(write(randomUUID()),/FORBIDDEN/);}finally{await fixture.pool.query("UPDATE juyu.member_operations SET status='conflict',finished_at=now() WHERE id=$1",[op]);}
 await fixture.pool.query("INSERT INTO juyu.role_enrollments(member_id,requested_role,purpose) VALUES('a','support','default')");
 try{await assert.rejects(read(),/FORBIDDEN/);await assert.rejects(write(randomUUID()),/FORBIDDEN/);}finally{await fixture.pool.query("UPDATE juyu.role_enrollments SET state='complete',confirmed_at=now() WHERE member_id='a'");}
});
async function waitForLock(query:string){const deadline=Date.now()+3000;while(Date.now()<deadline){if((await fixture.pool.query("SELECT count(*)::int n FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE $1",[query])).rows[0].n>0)return;await new Promise(r=>setTimeout(r,5));}assert.fail('real concurrent database lock was not reached');}
test('normal save rechecks definitions after a concurrent settings write commits',async()=>{
 const field=await write(randomUUID()),id=randomUUID(),snapshots=[{...field,value:'付款'}];let unlock!:()=>void,locked!:()=>void;
 const acquired=new Promise<void>(r=>{locked=r;}),release=new Promise<void>(r=>{unlock=r;});
 const change=db.run(admin,async c=>{const result=await writeFieldDefinition(c,field.id,{...config,expectedVersion:1,name:'改变'});locked();await release;return result;});
 await acquired;const saving=repo.saveEditor(id,{...input,customFields:snapshots},admin).then(value=>({value,error:null}),error=>({value:null,error}));
 try{await waitForLock('SELECT pg_advisory_xact_lock_shared(84620948)%');}finally{unlock();}await change;
 assert.match((await saving).error?.message??'unexpected success',/INVALID_INPUT|FIELD_CONFLICT/);assert.equal(await repo.getForManagement(id,admin),null);
});
test('configuration SQL rejects malformed data and raw mutations preserve generic settings',async()=>{
 const field=await write(randomUUID());
 for(const change of [{name:''},{name:'x'.repeat(81)},{extra:true},{options:[]},{options:['A','A']},{type:'script'},{required:'true'}])await assert.rejects(db.run(admin,c=>c.query('SELECT juyu.write_field_definition($1,1,$2)',[field.id,JSON.stringify({...config,expectedVersion:undefined,...change})])),/INVALID_INPUT/);
 await assert.rejects(fixture.pool.query('UPDATE juyu.settings SET enabled=false WHERE id=$1',[field.id]),/INVALID_INPUT/);
 await assert.rejects(fixture.pool.query("UPDATE juyu.settings SET kind='general' WHERE id=$1",[field.id]),/IMMUTABLE/);
 await assert.rejects(fixture.pool.query("INSERT INTO juyu.setting_versions(setting_id,version,config,changed_by) VALUES($1,2,'{}','a')",[field.id]),/INVALID_INPUT/);
 const general=randomUUID();await db.run(admin,async()=>{const c=await fixture.pool.connect();try{await c.query('BEGIN');await c.query("INSERT INTO juyu.settings(id,key,kind,current_version) VALUES($1,'general-test','general',1)",[general]);await c.query("INSERT INTO juyu.setting_versions(setting_id,version,config,changed_by) VALUES($1,1,'{}','a')",[general]);await c.query('COMMIT');}finally{c.release();}});
 assert.equal((await read()).length,1);
});
test('publication projection reveals saved fields only at the current authorized formal revision',async()=>{
 const field=await write(randomUUID()),snapshots=[{...field,value:'退款'}];const id=randomUUID();await repo.saveEditor(id,{...input,customFields:snapshots},admin);
 const projected=(v:Viewer)=>db.run(v,async c=>(await c.query('SELECT juyu.read_publication_fields($1) AS fields',[id])).rows[0].fields,true);
 assert.equal(await projected(support),null);let d=await publish((await repo.getForManagement(id,admin))!);assert.deepEqual(await projected(support),snapshots);
 await write(field.id,{...config,expectedVersion:1,name:'新标签'});assert.deepEqual(await projected(support),snapshots);
 assert.deepEqual((await service(support).article(id))?.customFields,snapshots);assert.deepEqual((await service(support).pdf(id,1)).article.customFields,snapshots);
 d=await repo.execute(id,{type:'edit',title:'Private',body:'new',audience:'admin',customFields:[{...(await read())[0],value:'付款'}]},admin,{expectedSequence:d.sequence});d=await publish(d);assert.equal(await projected(support),null);assert.deepEqual(await projected(admin),d.revisions.at(-1)!.customFields);
 assert.equal((await runtime.query('SELECT juyu.read_publication_fields($1) AS fields',[id])).rows[0].fields,null);
 const acls=(await fixture.pool.query("SELECT p.proname FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE p.pronamespace='juyu'::regnamespace AND p.proname IN('read_field_definitions','write_field_definition','read_publication_fields') AND a.grantee=0 AND a.privilege_type='EXECUTE'")).rows;assert.deepEqual(acls,[]);
});
test('legacy repository cannot write configured fields for an incompletely verified administrator',async()=>{
 const field=await write(randomUUID());const draft=await repo.create({id:randomUUID(),kind:'article',title:'Valid',body:'body',audience:'staff',customFields:[{...field,value:'付款'}]},admin);await fixture.pool.query("UPDATE juyu.members SET verified_email=null WHERE clerk_user_id='a'");
 try{await assert.rejects(repo.create({id:randomUUID(),kind:'article',title:'Legacy bypass',body:'body',audience:'staff',customFields:[{...field,value:'付款'}]},admin),/FORBIDDEN/);await assert.rejects(repo.execute(draft.id,{type:'edit',title:'Legacy bypass',body:'body',audience:'staff',customFields:[{...field,value:'退款'}]},admin,{expectedSequence:draft.sequence}),/FORBIDDEN/);}finally{await fixture.pool.query("UPDATE juyu.members SET verified_email='a@example.test' WHERE clerk_user_id='a'");}
});
test('settings writer rechecks current admin after waiting for a concurrent demotion',async()=>{
 const blocker=await fixture.pool.connect();await blocker.query('BEGIN');await blocker.query("UPDATE juyu.members SET observed_role='ops' WHERE clerk_user_id='a'");
 const writing=write(randomUUID()).then(value=>({value,error:null}),error=>({value:null,error}));
 try{await waitForLock('SELECT juyu.write_field_definition%');}finally{await blocker.query('COMMIT');blocker.release();}
 try{assert.match((await writing).error?.message??'unexpected success',/FORBIDDEN/);assert.equal((await fixture.pool.query('SELECT count(*)::int n FROM juyu.settings')).rows[0].n,0);}finally{await fixture.pool.query("UPDATE juyu.members SET observed_role='admin' WHERE clerk_user_id='a'");}
});
test('runtime raw revision inserts cannot bypass active requirements metadata or disabled preservation',async()=>{
 const field=await write(randomUUID()),snapshots=[{...field,value:'付款'}],d=await repo.create({id:randomUUID(),kind:'article',title:'Boundary',body:'body',audience:'staff',customFields:snapshots},admin);
 const insert=(fields:unknown,omit=false)=>db.run(admin,c=>c.query(`INSERT INTO juyu.revisions(document_id,revision_id,title,body,audience,author_id,editor_id,created_at${omit?'':',custom_fields'}) VALUES($1,2,'Raw','Raw','staff','a','a',now()${omit?'':',$2'})`,omit?[d.id]:[d.id,JSON.stringify(fields)]));
 await assert.rejects(insert([],true),/INVALID_INPUT/);
 for(const fields of [[],[{...field,value:null}],[{...field,value:'未知'}],[{...field,name:'伪造',value:'付款'}]])await assert.rejects(insert(fields),/INVALID_INPUT/);
 await write(field.id,{...config,expectedVersion:1,name:'新设置'});await assert.rejects(insert(snapshots),/FIELD_CONFLICT|INVALID_INPUT/);
 await write(field.id,{...config,expectedVersion:2,enabled:false});
 for(const fields of [[],[{...snapshots[0],value:null}]])await assert.rejects(insert(fields),/INVALID_INPUT/);
 await insert(snapshots);assert.deepEqual((await fixture.pool.query('SELECT custom_fields FROM juyu.revisions WHERE document_id=$1 AND revision_id=2',[d.id])).rows[0].custom_fields,snapshots);
});
test('raw SQL validates every value type real dates and Unicode blank values',async()=>{
 const fields=[];for(const type of ['text','number','date','boolean','select'] as const)fields.push(await write(randomUUID(),{...config,type,options:type==='select'?['A']:[],name:type}));
 const values={text:'Answer',number:0,date:'2024-02-29',boolean:false,select:'A'},snapshots=fields.map(f=>({...f,value:values[f.type]}));
 const d=await repo.create({id:randomUUID(),kind:'article',title:'Typed',body:'body',audience:'staff',customFields:snapshots},admin);
 const insert=(fields:unknown)=>db.run(admin,c=>c.query("INSERT INTO juyu.revisions(document_id,revision_id,title,body,audience,author_id,editor_id,created_at,custom_fields) VALUES($1,2,'Typed','Typed','staff','a','a',now(),$2)",[d.id,JSON.stringify(fields)]));
 for(const [type,value] of [['text','\u00a0\u2003\t'],['text','x'.repeat(2001)],['number','1'],['boolean','false'],['date','2026-02-29'],['date','0000-01-01'],['date','2026-2-01'],['select','B']] as const)await assert.rejects(insert(snapshots.map(f=>f.type===type?{...f,value}:f)),/INVALID_INPUT|check constraint/);
 await insert(snapshots);
 await assert.rejects(db.run(admin,c=>c.query('SELECT juyu.write_field_definition($1,NULL,$2)',[randomUUID(),JSON.stringify({name:'\u00a0',type:'text',options:[],required:false,enabled:true})])),/INVALID_INPUT/);
});
test('raw runtime SQL rechecks definitions when a configuration transaction commits while waiting',async()=>{
 const field=await write(randomUUID()),snapshots=[{...field,value:'付款'}],d=await repo.create({id:randomUUID(),kind:'article',title:'Race',body:'body',audience:'staff',customFields:snapshots},admin);let unlock!:()=>void,locked!:()=>void;
 const acquired=new Promise<void>(r=>{locked=r;}),release=new Promise<void>(r=>{unlock=r;});
 const changing=db.run(admin,async c=>{await writeFieldDefinition(c,field.id,{...config,expectedVersion:1,name:'New'});locked();await release;});await acquired;
 const inserting=db.run(admin,c=>c.query("INSERT INTO juyu.revisions(document_id,revision_id,title,body,audience,author_id,editor_id,created_at,custom_fields) VALUES($1,2,'Race','Race','staff','a','a',now(),$2)",[d.id,JSON.stringify(snapshots)])).then(value=>({value,error:null}),error=>({value:null,error}));
 try{await waitForLock('INSERT INTO juyu.revisions%');}finally{unlock();}await changing;assert.match((await inserting).error?.message??'unexpected success',/FIELD_CONFLICT/);assert.equal((await fixture.pool.query('SELECT count(*)::int n FROM juyu.revisions WHERE document_id=$1',[d.id])).rows[0].n,1);
});
