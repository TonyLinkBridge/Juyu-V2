import assert from 'node:assert/strict';
import {before,after,beforeEach,test} from 'node:test';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import type {Pool} from 'pg';
import {temporaryDatabase} from './fixture.ts';
import {migrate} from '../../src/server/database/migrate.ts';
import {ScopedDatabase} from '../../src/server/database/scoped.ts';
import {DocumentRepository} from '../../src/server/database/repository.ts';
import {AuthorizationService} from '../../src/server/authorization/service.ts';
import {readAnalyticsDashboard} from '../../src/server/analytics/dashboard.ts';
import {captureAnalytics} from '../../src/server/analytics/repository.ts';
import type {Viewer,Document} from '../../src/domain/model.ts';
let fixture:Awaited<ReturnType<typeof temporaryDatabase>>,runtime:Pool,issuer:Pool,db:ScopedDatabase,repo:DocumentRepository;
const admin:Viewer={id:'a',role:'admin',companyVerified:true},superAdmin:Viewer={id:'x',role:'super_admin',companyVerified:true},reviewer:Viewer={...admin,id:'b'},ops:Viewer={id:'o',role:'ops',companyVerified:true},support:Viewer={id:'s',role:'support',companyVerified:true};
const service=(v:Viewer|null=support)=>new AuthorizationService(db,async()=>v);
const read=(days:7|30|90=30,v:Viewer|null=admin)=>db.run(v,c=>readAnalyticsDashboard(c,days),true);
const fingerprint=(value:string)=>'sha256:'+createHash('sha256').update(value).digest('hex');
const zero={searches:0,zeroResults:0,clickedSearches:0,searchClicks:0,views:0,feedbackTotal:0,feedbackNegative:0};
async function draft(title='Current formal',kind:Document['kind']='reference'){return repo.create({id:randomUUID(),kind,title,audience:kind==='ops'?'ops':'staff',body:'Private body',tags:[]},admin);}
async function publish(d:Document){await service(admin).submitReview(d.id,{expectedSequence:d.sequence,reviewerId:'b'});await service(reviewer).decideReview(d.id,{expectedSequence:d.sequence+1,action:'approve'});await service(admin).changePublication(d.id,{expectedSequence:d.sequence+2,action:'queue'});await service(admin).changePublication(d.id,{expectedSequence:d.sequence+3,action:'publish'});return (await repo.getForManagement(d.id,admin))!;}
async function search(query:string,total=0,age='1 day',documentId?:string){const id=randomUUID();await fixture.pool.query('INSERT INTO juyu.search_queries(id,member_id,query,result_count,occurred_at) VALUES($1,\'s\',$2,$3,transaction_timestamp()-$4::interval)',[id,fingerprint(query),total,age]);if(documentId)await fixture.pool.query('INSERT INTO juyu.search_results(search_id,position,document_id,revision_id) VALUES($1,1,$2,1)',[id,documentId]);return id;}
async function event(documentId:string,kind:'view'|'search_click'='view',age='1 day',searchId:string|null=null,revision=1){await fixture.pool.query('INSERT INTO juyu.analytics_events(id,member_id,kind,document_id,revision_id,search_id,result_position,occurred_at) VALUES($1,\'s\',$2,$3,$4,$5,$6,transaction_timestamp()-$7::interval)',[randomUUID(),kind,documentId,revision,searchId,searchId?1:null,age]);}
before(async()=>{fixture=await temporaryDatabase();await migrate(fixture.pool);await fixture.pool.query("INSERT INTO juyu.members(clerk_user_id,display_name,observed_role,verified_email,observed_at) VALUES('a','Private Admin','admin','a@example.test',now()),('x','Private Super Admin','super_admin','x@example.test',now()),('b','Private Reviewer','admin','b@example.test',now()),('o','Private Ops','ops','o@example.test',now()),('s','Private Support','support','s@example.test',now())");const rp=randomBytes(24).toString('hex'),ip=randomBytes(24).toString('hex');await fixture.pool.query(`CREATE ROLE dashboard_runtime LOGIN PASSWORD '${rp}' IN ROLE juyu_runtime; CREATE ROLE dashboard_issuer LOGIN PASSWORD '${ip}' IN ROLE juyu_context_issuer`);runtime=fixture.connectAs('dashboard_runtime',rp);issuer=fixture.connectAs('dashboard_issuer',ip);db=new ScopedDatabase(runtime,issuer);repo=new DocumentRepository(db);});
after(async()=>{await runtime?.end();await issuer?.end();await fixture?.close();});
beforeEach(async()=>{await fixture.pool.query('TRUNCATE juyu.documents,juyu.search_queries CASCADE');});
test('empty data is a truthful zero summary with database-clock ranges; failures still throw',async()=>{
 for(const days of [7,30,90] as const){const before=Date.now(),data=await read(days);assert.deepEqual(data.summary,zero);assert.equal(data.days,days);assert.equal(Date.parse(data.asOf)-Date.parse(data.from),days*86400000);assert.ok(Date.parse(data.asOf)>=before&&Date.parse(data.asOf)<=Date.now());for(const key of ['popularSearches','zeroResultSearches','popularArticles','negativeFeedback'] as const)assert.deepEqual(data[key],[]);}
 assert.deepEqual((await read(30,superAdmin)).summary,zero);
 await assert.rejects(read(30,support),/FORBIDDEN/);await assert.rejects(db.run(admin,c=>readAnalyticsDashboard(c,8 as 7),true),/INVALID_INPUT/);
});
test('repository itself denies non-admin and every stale or pending member identity',async()=>{
 for(const actor of [support,ops,null,{...admin,companyVerified:false}])await assert.rejects(read(30,actor),/FORBIDDEN/);
 for(const state of ["disabled_at=now()","observed_role='ops'","verified_email=null","verified_email='   '","observed_at=null"]){await fixture.pool.query(`UPDATE juyu.members SET ${state} WHERE clerk_user_id='a'`);try{await assert.rejects(read(),/FORBIDDEN/);}finally{await fixture.pool.query("UPDATE juyu.members SET disabled_at=null,observed_role='admin',verified_email='a@example.test',observed_at=now() WHERE clerk_user_id='a'");}}
 await fixture.pool.query("INSERT INTO juyu.member_operations(actor_id,target_id,kind,before_role,requested_role) VALUES('b','a','role','admin','ops')");try{await assert.rejects(read(),/FORBIDDEN/);}finally{await fixture.pool.query("UPDATE juyu.member_operations SET status='conflict',finished_at=now() WHERE target_id='a' AND status='pending'");}
 const c=await runtime.connect();try{await assert.rejects(readAnalyticsDashboard(c),/FORBIDDEN/);}finally{c.release();}
});
test('search CTR counts distinct searches, click cohort and all timestamp bounds while views remain separate',async()=>{
 const d=await publish(await draft()),sid=await search('same',1,'1 day',d.id);await search('same',0);await search('zero');const old=await search('outside',1,'31 days',d.id);await search('future',0,'-1 day');
 for(let i=0;i<4;i++)await event(d.id,'search_click','1 day',sid);await event(d.id,'search_click','31 days',sid);await event(d.id,'search_click','-1 day',sid);await event(d.id,'search_click','1 day',old);await event(d.id);await event(d.id,'view','31 days');await event(d.id,'view','-1 day');
 const data=await read();assert.deepEqual(data.summary,{...zero,searches:3,zeroResults:2,clickedSearches:1,searchClicks:4,views:1});assert.deepEqual(data.popularSearches.find(x=>x.fingerprint===fingerprint('same')),{fingerprint:fingerprint('same'),searches:2,zeroResults:1,clickedSearches:1});assert.ok(data.summary.clickedSearches/data.summary.searches<=1);assert.equal((await read(90)).summary.searches,4);
});
test('popular and zero-result groups use separate stable top tens, never raw terms or employee identifiers',async()=>{
 for(let i=0;i<12;i++){await search('hot-'+i,1);await search('hot-'+i,1);}for(let i=0;i<12;i++)await search('private-zero-'+i);
 const data=await read();assert.equal(data.summary.searches,36);assert.equal(data.popularSearches.length,10);assert.equal(data.zeroResultSearches.length,10);
 assert.deepEqual(data.popularSearches.map(x=>x.fingerprint),Array.from({length:12},(_,i)=>fingerprint('hot-'+i)).sort().slice(0,10));assert.deepEqual(data.zeroResultSearches.map(x=>x.fingerprint),Array.from({length:12},(_,i)=>fingerprint('private-zero-'+i)).sort().slice(0,10));
 for(const group of [...data.popularSearches,...data.zeroResultSearches])assert.deepEqual(Object.keys(group).sort(),['clickedSearches','fingerprint','searches','zeroResults']);
 assert.doesNotMatch(JSON.stringify(data),/private-zero|hot-|Private (Admin|Support)|example.test|member_id|search_id/);
});
test('view rankings aggregate old revisions but expose only current formal metadata and current readable scope',async()=>{
 const d=await publish(await draft('Old formal title'));await event(d.id);const current=await publish(await repo.execute(d.id,{type:'edit',title:'Current formal title',body:'Current private body',audience:'staff'},admin,{expectedSequence:d.sequence}));await repo.execute(d.id,{type:'edit',title:'Secret draft title',body:'Secret draft body',audience:'staff'},admin,{expectedSequence:current.sequence});
 await event(d.id,'view','1 day',null,2);const hidden=await publish(await draft('Hidden')),draftOnly=await draft('Draft only'),internal=await publish(await draft('OPS current','ops'));await event(hidden.id);await event(draftOnly.id);await event(internal.id);const category=randomUUID();await fixture.pool.query("INSERT INTO juyu.categories(id,name,enabled) VALUES($1,'Disabled',false)",[category]);await fixture.pool.query('INSERT INTO juyu.revision_categories VALUES($1,1,$2)',[hidden.id,category]);
 const data=await read();assert.equal(data.summary.views,3);assert.deepEqual(data.popularArticles.find(x=>x.documentId===d.id),{documentId:d.id,title:'Current formal title',kind:'reference',revision:2,views:2});assert.equal(data.popularArticles.length,2);assert.doesNotMatch(JSON.stringify(data),/Old formal|Secret draft|private body|Draft only|Hidden/);
 await fixture.pool.query("UPDATE juyu.documents SET lifecycle='archived' WHERE id=$1",[d.id]);assert.equal((await read()).summary.views,1);
 await service(admin).lifecycle(internal.id,{expectedSequence:internal.sequence,action:'trash'});await service(admin).lifecycle(internal.id,{expectedSequence:internal.sequence+1,action:'purge',confirmation:'OPS current'});assert.equal((await read()).summary.views,0);
});
test('feedback uses latest current-publication rows and updated time, never historical analytics or comments',async()=>{
 const d=await publish(await draft());await service().saveFeedback(d.id,{revision:1,helpful:false,comment:'Private negative comment',expectedVersion:0});let data=await read();assert.equal(data.summary.feedbackTotal,1);assert.equal(data.summary.feedbackNegative,1);assert.deepEqual(data.negativeFeedback,[{documentId:d.id,title:'Current formal',kind:'reference',revision:1,total:1,negative:1}]);
 await service().saveFeedback(d.id,{revision:1,helpful:true,comment:'Private changed comment',expectedVersion:1});data=await read();assert.equal(data.summary.feedbackTotal,1);assert.equal(data.summary.feedbackNegative,0);assert.deepEqual(data.negativeFeedback,[]);assert.equal((await fixture.pool.query("SELECT count(*)::int n FROM juyu.analytics_events WHERE kind='feedback'")).rows[0].n,2);
 await service(ops).saveFeedback(d.id,{revision:1,helpful:false,comment:'Private ops',expectedVersion:0});await fixture.pool.query("UPDATE juyu.feedback SET updated_at=now()-interval '31 days' WHERE member_id='o'");assert.equal((await read()).summary.feedbackNegative,0);await fixture.pool.query("UPDATE juyu.feedback SET updated_at=now()+interval '1 day' WHERE member_id='o'");assert.equal((await read()).summary.feedbackNegative,0);
 await publish(await repo.execute(d.id,{type:'edit',title:'Current two',body:'Private',audience:'staff'},admin,{expectedSequence:d.sequence}));data=await read();assert.equal(data.summary.feedbackTotal,0);assert.doesNotMatch(JSON.stringify(data),/Private|comment|helpful|member_id/);
});
test('real capture contributes separate views, searches and clicks without exposing its receipts',async()=>{
 const d=await publish(await draft('Formal')),snapshot={eventId:randomUUID(),query:'Formal',page:1,total:1,results:[{documentId:d.id,revision:1}]};await db.run(support,async c=>{await captureAnalytics(c,{kind:'view',eventId:randomUUID(),documentId:d.id,revision:1});await captureAnalytics(c,{kind:'search_click',eventId:randomUUID(),documentId:d.id,revision:1,position:1,search:snapshot});});assert.deepEqual((await read()).summary,{...zero,views:1,searches:1,clickedSearches:1,searchClicks:1});
});
test('repeatable-read dashboard remains one snapshot across concurrent activity and publication changes and rejects writes',async()=>{
 const d=await publish(await draft());await event(d.id);await search('before');
 await db.run(admin,async c=>{assert.equal((await c.query('SHOW transaction_read_only')).rows[0].transaction_read_only,'on');assert.equal((await c.query('SHOW transaction_isolation')).rows[0].transaction_isolation,'repeatable read');const first=await readAnalyticsDashboard(c);await fixture.pool.query("UPDATE juyu.documents SET lifecycle='archived' WHERE id=$1",[d.id]);await search('during');const second=await readAnalyticsDashboard(c);assert.deepEqual(second,first);},true);
 assert.equal((await read()).summary.views,0);assert.equal((await read()).summary.searches,2);
 await assert.rejects(db.run(admin,c=>c.query("UPDATE juyu.members SET display_name='Changed' WHERE clerk_user_id='a'"),true),/read-only transaction|permission denied/);
});
test('exact database boundaries are inclusive at both ends and exclude one microsecond outside for every metric',async()=>{
 const d=await publish(await draft()),c=await runtime.connect(),token=randomBytes(32).toString('hex'),hash=createHash('sha256').update(token).digest('hex');
 try{
  const pid=(await c.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  await issuer.query("INSERT INTO juyu.request_contexts(token_hash,backend_pid,member_id,role,expires_at) VALUES($1,$2,'a','admin',clock_timestamp()+interval '60 seconds')",[hash,pid]);
  // BEGIN starts the DB clock; the owner seeds exact boundaries before this reader takes its first snapshot.
  await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const asOf=(await fixture.pool.query('SELECT xact_start::text value FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0].value;
  assert.ok(asOf);
  const offsets=['-30 days','0 seconds','-30 days -1 microsecond','1 microsecond'];
  for(let i=0;i<offsets.length;i++){
   const sid=randomUUID();
   await fixture.pool.query('INSERT INTO juyu.search_queries(id,member_id,query,result_count,occurred_at) VALUES($1,\'s\',$2,1,$3::timestamptz+$4::interval)',[sid,fingerprint('edge-'+i),asOf,offsets[i]]);
   await fixture.pool.query('INSERT INTO juyu.search_results(search_id,position,document_id,revision_id) VALUES($1,1,$2,1)',[sid,d.id]);
   for(const kind of ['view','search_click'])await fixture.pool.query('INSERT INTO juyu.analytics_events(id,member_id,kind,document_id,revision_id,search_id,result_position,occurred_at) VALUES($1,\'s\',$2,$3,1,$4,$5,$6::timestamptz+$7::interval)',[randomUUID(),kind,d.id,kind==='search_click'?sid:null,kind==='search_click'?1:null,asOf,offsets[i]]);
   await fixture.pool.query('INSERT INTO juyu.feedback(member_id,document_id,revision_id,helpful,updated_at) VALUES($1,$2,1,false,$3::timestamptz+$4::interval)',[['a','b','o','s'][i],d.id,asOf,offsets[i]]);
  }
  await c.query("SELECT set_config('juyu.token',$1,true)",[token]);
  const data=await readAnalyticsDashboard(c);assert.equal(Date.parse(data.asOf),Date.parse(asOf));assert.deepEqual(data.summary,{searches:2,zeroResults:0,clickedSearches:2,searchClicks:2,views:2,feedbackTotal:2,feedbackNegative:2});
  assert.deepEqual(data.popularSearches.map(x=>x.fingerprint).sort(),[fingerprint('edge-0'),fingerprint('edge-1')].sort());
 }finally{await c.query('ROLLBACK');c.release();await issuer.query('DELETE FROM juyu.request_contexts WHERE token_hash=$1',[hash]);}
});
test('article and negative feedback totals cover all eligible rows while top tens use deterministic count and id ordering',async()=>{
 const expected:{documentId:string;title:string;kind:'reference';revision:number;views:number;total:number;negative:number}[]=[];
 for(let i=0;i<12;i++){
  const d=await publish(await draft('Current '+i)),views=i<2?3:1,negative=i<2?2:1,total=i===0?3:negative;
  for(let n=0;n<views;n++)await event(d.id);
  for(let n=0;n<total;n++)await fixture.pool.query('INSERT INTO juyu.feedback(member_id,document_id,revision_id,helpful) VALUES($1,$2,1,$3)',[['s','o','b'][n],d.id,n>=negative]);
  expected.push({documentId:d.id,title:'Current '+i,kind:'reference',revision:1,views,total,negative});
 }
 const compareId=(a:{documentId:string},b:{documentId:string})=>a.documentId<b.documentId?-1:a.documentId>b.documentId?1:0;
 const data=await read();assert.equal(data.summary.views,16);assert.equal(data.summary.feedbackTotal,15);assert.equal(data.summary.feedbackNegative,14);
 assert.deepEqual(data.popularArticles,expected.toSorted((a,b)=>b.views-a.views||compareId(a,b)).slice(0,10).map(({documentId,title,kind,revision,views})=>({documentId,title,kind,revision,views})));
 assert.deepEqual(data.negativeFeedback,expected.toSorted((a,b)=>b.negative-a.negative||b.total-a.total||compareId(a,b)).slice(0,10).map(({documentId,title,kind,revision,total,negative})=>({documentId,title,kind,revision,total,negative})));
});
test('pending role enrollment denies access even with otherwise valid admin observation',async()=>{
 await fixture.pool.query("INSERT INTO juyu.role_enrollments(member_id,requested_role,purpose) VALUES('a','admin','bootstrap')");try{await assert.rejects(read(),/FORBIDDEN/);}finally{await fixture.pool.query("UPDATE juyu.role_enrollments SET state='complete',confirmed_at=now() WHERE member_id='a'");}
});
