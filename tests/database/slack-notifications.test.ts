import assert from 'node:assert/strict';
import {after,before,test} from 'node:test';
import {randomBytes,randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import {migrate} from '../../src/server/database/migrate.ts';
import {ScopedDatabase} from '../../src/server/database/scoped.ts';
import {AuthorizationService} from '../../src/server/authorization/service.ts';
import {temporaryDatabase} from './fixture.ts';
import type {Viewer} from '../../src/domain/model.ts';
import {encodeEditorBody} from '../../src/editor/document.ts';
import {dispatchSlackOutbox} from '../../src/server/slack/dispatch.ts';

const a:Viewer={id:'a',role:'admin',companyVerified:true};
const b:Viewer={id:'b',role:'admin',companyVerified:true};
let fixture:Awaited<ReturnType<typeof temporaryDatabase>>,runtime:Pool,issuer:Pool,db:ScopedDatabase;
const service=(viewer:Viewer)=>new AuthorizationService(db,async()=>viewer);
const draft=(_id:string,sequence:number|null,title:string)=>({expectedSequence:sequence,kind:'article' as const,title,body:encodeEditorBody([{id:'text',type:'paragraph',content:[{type:'text',text:'正文',styles:{}}]}]),audience:'staff' as const,tags:[],cover:null});

before(async()=>{
 fixture=await temporaryDatabase();await migrate(fixture.pool);
 await fixture.pool.query("INSERT INTO juyu.members(clerk_user_id,display_name,observed_role,verified_email,observed_at) VALUES('a','作者','admin','a@example.test',now()),('b','审核者','admin','b@example.test',now())");
 const rp=randomBytes(24).toString('hex'),ip=randomBytes(24).toString('hex');
 await fixture.pool.query(`CREATE ROLE slack_runtime LOGIN PASSWORD '${rp}' IN ROLE juyu_runtime; CREATE ROLE slack_issuer LOGIN PASSWORD '${ip}' IN ROLE juyu_context_issuer`);
 runtime=fixture.connectAs('slack_runtime',rp);issuer=fixture.connectAs('slack_issuer',ip);db=new ScopedDatabase(runtime,issuer);
});
after(async()=>{await runtime?.end();await issuer?.end();await fixture?.close();});

test('committed workflow events queue once while ordinary autosaves stay quiet',async()=>{
 const id=randomUUID(),A=service(a),B=service(b);
 let saved=await A.saveDraft(id,draft(id,null,'首版'));
 assert.equal((await fixture.pool.query('SELECT count(*)::int n FROM juyu.slack_outbox WHERE document_id=$1',[id])).rows[0].n,0);
 saved=await A.saveDraft(id,draft(id,saved.sequence,'首版修正'));
 assert.equal((await fixture.pool.query('SELECT count(*)::int n FROM juyu.slack_outbox WHERE document_id=$1',[id])).rows[0].n,0);
 const submitted=await A.submitReview(id,{expectedSequence:saved.sequence,reviewerId:'b'});
 assert.deepEqual(await A.submitReview(id,{expectedSequence:saved.sequence,reviewerId:'b'}),submitted);
 const approved=await B.decideReview(id,{expectedSequence:submitted.sequence,action:'approve'});
 await A.changePublication(id,{expectedSequence:approved.sequence,action:'queue'});
 const first=await A.changePublication(id,{expectedSequence:approved.sequence+1,action:'publish'});
 saved=await A.saveDraft(id,draft(id,first.sequence,'第二版'));
 saved=await A.saveDraft(id,draft(id,saved.sequence,'第二版修正'));
 const events=(await fixture.pool.query('SELECT event,sequence FROM juyu.slack_outbox WHERE document_id=$1 ORDER BY sequence',[id])).rows;
 assert.deepEqual(events.map(e=>e.event),['submitted','approved','published','revision_started']);
 assert.equal(new Set(events.map(e=>e.sequence)).size,events.length);
});

test('worker retries a failed Slack response and never resends a delivered event',async()=>{
 const id=randomUUID(),A=service(a);const saved=await A.saveDraft(id,draft(id,null,'通知演练'));
 await A.submitReview(id,{expectedSequence:saved.sequence,reviewerId:'b'});
 await fixture.pool.query('DELETE FROM juyu.slack_outbox WHERE document_id<>$1',[id]);
 let calls=0;const bodies:unknown[]=[];
 const transport:typeof fetch=async(_url,init)=>{
  calls+=1;bodies.push(JSON.parse(String(init?.body)));
  return Response.json(calls===1?{ok:false,error:'not_in_channel'}:{ok:true,ts:'1790000000.000001'});
 };
 const config={token:'xoxb-test',channel:'C0BQ4M16EDB',origin:'https://juyu-helpcentre.vercel.app'};
 assert.deepEqual(await dispatchSlackOutbox(issuer,config,1,transport),{sent:0,failed:1});
 let row=(await fixture.pool.query('SELECT attempts,sent_at,last_error FROM juyu.slack_outbox WHERE document_id=$1',[id])).rows[0];
 assert.equal(row.attempts,1);assert.equal(row.sent_at,null);assert.equal(row.last_error,'not_in_channel');
 await fixture.pool.query('UPDATE juyu.slack_outbox SET next_attempt_at=clock_timestamp() WHERE document_id=$1',[id]);
 assert.deepEqual(await dispatchSlackOutbox(issuer,config,1,transport),{sent:1,failed:0});
 row=(await fixture.pool.query('SELECT attempts,sent_at,slack_ts FROM juyu.slack_outbox WHERE document_id=$1',[id])).rows[0];
 assert.equal(row.attempts,2);assert.ok(row.sent_at);assert.equal(row.slack_ts,'1790000000.000001');
 assert.deepEqual(await dispatchSlackOutbox(issuer,config,1,transport),{sent:0,failed:0});
 assert.equal(calls,2);assert.match(JSON.stringify(bodies[1]),/通知演练/);
});

test('a restricted draft queues its event without exposing its title to Slack',async()=>{
 const id=randomUUID(),A=service(a);
 const saved=await A.saveDraft(id,{...draft(id,null,'只有管理员可读的标题'),audience:'admin'});
 await A.submitReview(id,{expectedSequence:saved.sequence,reviewerId:'b'});
 const row=(await fixture.pool.query('SELECT event,title FROM juyu.slack_outbox WHERE document_id=$1',[id])).rows[0];
 assert.deepEqual(row,{event:'submitted',title:null});
});
