import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {temporaryDatabase} from './fixture.ts';
import {migrate} from '../../src/server/database/migrate.ts';
import {ScopedDatabase} from '../../src/server/database/scoped.ts';
import {DeveloperService} from '../../src/server/developers/service.ts';
import {appendTelemetry,pruneTelemetry} from '../../src/server/developers/repository.ts';
import {AuthorizationService} from '../../src/server/authorization/service.ts';
import {encodeEditorBody} from '../../src/editor/document.ts';
import type {Viewer} from '../../src/domain/model.ts';
let fixture:Awaited<ReturnType<typeof temporaryDatabase>>,runtime:Pool,issuer:Pool,db:ScopedDatabase;
const superViewer:Viewer={id:'s',role:'super_admin',companyVerified:true},admin:Viewer={id:'a',role:'admin',companyVerified:true};
const service=(viewer:Viewer)=>new DeveloperService(db,async()=>viewer,{});
before(async()=>{fixture=await temporaryDatabase();await migrate(fixture.pool);await fixture.pool.query("INSERT INTO juyu.members(clerk_user_id,display_name,observed_role,verified_email,observed_at) VALUES('s','Super','super_admin','s@example.test',now()),('a','Admin','admin','a@example.test',now())");const rp=randomBytes(24).toString('hex'),ip=randomBytes(24).toString('hex');await fixture.pool.query(`CREATE ROLE developers_runtime LOGIN PASSWORD '${rp}' IN ROLE juyu_runtime;CREATE ROLE developers_issuer LOGIN PASSWORD '${ip}' IN ROLE juyu_context_issuer`);runtime=fixture.connectAs('developers_runtime',rp);issuer=fixture.connectAs('developers_issuer',ip);db=new ScopedDatabase(runtime,issuer);});
after(async()=>{await runtime?.end();await issuer?.end();await fixture?.close();});
test('only currently eligible Super Admin can read operational data and RLS blocks Admin',async()=>{
 await appendTelemetry(issuer,[{source:'request',name:'asset',status:502,durationMs:41,level:'error'}]);
 const data=await service(superViewer).events(new URLSearchParams('source=request&level=error'));assert.equal(data.items.length,1);assert.equal(data.items[0].status,502);
 await assert.rejects(service(admin).events(new URLSearchParams()),/FORBIDDEN/);
 assert.equal(await db.run(admin,async c=>(await c.query('SELECT * FROM juyu.developer_events')).rowCount,true),0);
 await fixture.pool.query("UPDATE juyu.members SET observed_role='admin' WHERE clerk_user_id='s'");await assert.rejects(service(superViewer).overview(7),/FORBIDDEN/);assert.equal(await db.run(superViewer,async c=>(await c.query('SELECT * FROM juyu.developer_events')).rowCount,true),0);assert.equal(await db.run(superViewer,async c=>(await c.query('SELECT * FROM juyu.slack_outbox')).rowCount,true),0);await fixture.pool.query("UPDATE juyu.members SET observed_role='super_admin' WHERE clerk_user_id='s'");
 await fixture.pool.query("UPDATE juyu.members SET disabled_at=now() WHERE clerk_user_id='s'");await assert.rejects(service(superViewer).events(new URLSearchParams()),/FORBIDDEN/);await fixture.pool.query("UPDATE juyu.members SET disabled_at=NULL WHERE clerk_user_id='s'");
});
test('request metrics use retained records and filters use literal text',async()=>{
 await appendTelemetry(issuer,[{source:'request',name:'pdf',status:200,durationMs:59,level:'info'}]);
 const data=await service(superViewer).overview(7);assert.equal(data.requests.count,2);assert.equal(data.requests.failed,1);assert.equal(data.requests.averageMs,50);
 assert.equal((await service(superViewer).events(new URLSearchParams('q=%'))).items.length,0);
 assert.equal((await service(superViewer).events(new URLSearchParams('source=request&level=info'))).items.length,1);
});
test('only failed unleased notification retries; receipt is idempotent and sent rows stay sent',async()=>{
 const A=new AuthorizationService(db,async()=>superViewer),id=randomUUID();const draft=await A.saveDraft(id,{expectedSequence:null,kind:'article',title:'开发者测试',audience:'staff',tags:[],cover:null,body:encodeEditorBody([{id:'p',type:'paragraph',content:[{type:'text',text:'正文',styles:{}}]}])});
 await A.changePublication(id,{action:'direct_publish',expectedSequence:draft.sequence});
 const row=(await fixture.pool.query('SELECT sequence FROM juyu.slack_outbox WHERE document_id=$1',[id])).rows[0];assert.ok(row);
 await fixture.pool.query("UPDATE juyu.slack_outbox SET attempts=1,last_error='timeout',next_attempt_at=now()+interval '1 hour' WHERE document_id=$1",[id]);
 await fixture.pool.query("UPDATE juyu.slack_outbox SET last_error='private_vendor_diagnostic' WHERE document_id=$1",[id]);
 const safeHistory=await service(superViewer).notifications(new URLSearchParams());assert.equal(safeHistory.items.find(x=>x.documentId===id)?.lastError,'DELIVERY_FAILED');
 const safeEvents=await service(superViewer).events(new URLSearchParams('source=slack'));assert.equal(safeEvents.items.find(x=>x.documentId===id)?.detail.error,'DELIVERY_FAILED');
 await fixture.pool.query("UPDATE juyu.slack_outbox SET last_error='rate_limited' WHERE document_id=$1",[id]);assert.equal((await service(superViewer).notifications(new URLSearchParams())).items.find(x=>x.documentId===id)?.lastError,'rate_limited');
 const requestId=randomUUID();await assert.rejects(service(admin).retry(id,row.sequence,requestId),/FORBIDDEN/);
 assert.deepEqual(await service(superViewer).retry(id,row.sequence,requestId),{scheduled:true});assert.deepEqual(await service(superViewer).retry(id,row.sequence,requestId),{scheduled:false});
 assert.equal((await fixture.pool.query("SELECT count(*)::int n FROM juyu.developer_events WHERE source='operator' AND operation_id=$1",[requestId])).rows[0].n,1);
 assert.equal((await issuer.query("DELETE FROM juyu.developer_events WHERE source='operator' AND operation_id=$1",[requestId])).rowCount,0);assert.deepEqual(await service(superViewer).retry(id,row.sequence,requestId),{scheduled:false});
 await fixture.pool.query("UPDATE juyu.slack_outbox SET claim_id=$2,lease_until=now()+interval '2 minutes' WHERE document_id=$1",[id,randomUUID()]);await assert.rejects(service(superViewer).retry(id,row.sequence,randomUUID()),/CONFLICT/);
 await fixture.pool.query("UPDATE juyu.slack_outbox SET sent_at=now(),slack_ts='1.2',claim_id=NULL,lease_until=NULL WHERE document_id=$1",[id]);await assert.rejects(service(superViewer).retry(id,row.sequence,randomUUID()),/CONFLICT/);
 const history=await service(superViewer).notifications(new URLSearchParams());assert.equal(history.items.find(x=>x.documentId===id)?.state,'sent');
});

test('diagnostics preserve only validated cause, check results persist and technical retention keeps retry receipts',async()=>{
 const attempt=randomUUID();await appendTelemetry(issuer,[{source:'publication-client',name:'blocked',level:'warning',actorId:'s',documentId:'00000000-0000-4000-8000-000000000001',diagnostic:{attempt,stage:'blocked',sequence:3,reason:'uploading',online:true}},{source:'connection',name:'slack',level:'error',status:503,code:'SLACK_WORKSPACE_MISMATCH'}]);
 const events=await service(superViewer).events(new URLSearchParams('source=publication-client'));assert.equal(events.items[0].detail.reason,'uploading');assert.equal(events.items[0].detail.attempt,attempt);
 assert.equal((await service(superViewer).events(new URLSearchParams('q=SLACK_WORKSPACE_MISMATCH'))).items.length,1);
 const connection=await new DeveloperService(db,async()=>superViewer,{SLACK_BOT_TOKEN:'xoxb-private-test-value',SLACK_NOTIFICATION_CHANNEL_ID:'C123456789',ALLOWED_SLACK_TEAM_ID:'T123456789',APP_ORIGIN:'https://example.test'}).integrations();assert.equal(connection.find(x=>x.id==='slack')?.check,'failed');assert.ok(!JSON.stringify(connection).includes('xoxb-private-test-value'));
 const before=(await fixture.pool.query("SELECT count(*)::int n FROM juyu.developer_events WHERE source='operator'")).rows[0].n;
 await fixture.pool.query("UPDATE juyu.developer_events SET at=now()-interval '40 days'");await pruneTelemetry(issuer);assert.equal((await fixture.pool.query("SELECT count(*)::int n FROM juyu.developer_events WHERE source<>'operator'")).rows[0].n,0);assert.equal((await fixture.pool.query("SELECT count(*)::int n FROM juyu.developer_events WHERE source='operator'")).rows[0].n,before);
 await fixture.pool.query('ALTER TABLE juyu.developer_events RENAME TO temporarily_missing_developer_events');try{await assert.rejects(service(superViewer).overview(7),/DEVELOPERS_NOT_READY/);}finally{await fixture.pool.query('ALTER TABLE juyu.temporarily_missing_developer_events RENAME TO developer_events');}
});

test('parallel check persistence releases scoped connections before borrowing the two-slot worker pool',async()=>{
 const {persistConnectionResult}=await import('../../src/server/developers/connection-record.ts');
 const limited=new Pool({...issuer.options,password:issuer.options.password,max:2,connectionTimeoutMillis:1000});
 try{
  const accessService=new DeveloperService(new ScopedDatabase(runtime,limited),async()=>superViewer,{});
  const result={...((await service(superViewer).integrations())[0]),checkedAt:new Date().toISOString(),check:'ok' as const,code:'CHECK_OK' as const};
  await Promise.all(['clerk','database'].map(id=>persistConnectionResult({...result,id:id as 'clerk'|'database'},()=>accessService.access(),records=>appendTelemetry(limited,records))));
  assert.equal((await fixture.pool.query("SELECT count(*)::int n FROM juyu.developer_events WHERE source='connection' AND code='CHECK_OK'")).rows[0].n,2);
 }finally{await limited.end();}
});
