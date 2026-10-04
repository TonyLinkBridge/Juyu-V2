import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import {temporaryDatabase} from './fixture.ts';
import {migrate} from '../../src/server/database/migrate.ts';
import {ScopedDatabase} from '../../src/server/database/scoped.ts';
import {AuthorizationService} from '../../src/server/authorization/service.ts';
import {encodeEditorBody} from '../../src/editor/document.ts';
import {DeveloperService} from '../../src/server/developers/service.ts';
let fixture:Awaited<ReturnType<typeof temporaryDatabase>>,runtime:Pool,issuer:Pool,service:DeveloperService;
before(async()=>{
 fixture=await temporaryDatabase();await migrate(fixture.pool);
 await fixture.pool.query("INSERT INTO juyu.members(clerk_user_id,display_name,observed_role,verified_email,observed_at) VALUES('s','Super','super_admin','s@example.test',now())");
 const rp=randomBytes(24).toString('hex'),ip=randomBytes(24).toString('hex');await fixture.pool.query(`CREATE ROLE layout_runtime LOGIN PASSWORD '${rp}' IN ROLE juyu_runtime;CREATE ROLE layout_issuer LOGIN PASSWORD '${ip}' IN ROLE juyu_context_issuer`);
 runtime=fixture.connectAs('layout_runtime',rp);issuer=fixture.connectAs('layout_issuer',ip);service=new DeveloperService(new ScopedDatabase(runtime,issuer),async()=>({id:'s',role:'super_admin',companyVerified:true}),{});
});
after(async()=>{await runtime?.end();await issuer?.end();await fixture?.close();});
test('custom date uses Malaysian midnight boundaries and summary includes matching records beyond the current page',async()=>{
 await fixture.pool.query(`INSERT INTO juyu.developer_events(at,source,name,level,status,duration_ms) VALUES('2026-01-01T15:59:59Z','request','asset','info',200,10),('2026-01-01T16:00:00Z','request','asset','error',502,30),('2026-01-02T15:59:59Z','request','pdf','warning',429,90),('2026-01-02T16:00:00Z','request','asset','info',200,20)`);
 await fixture.pool.query("INSERT INTO juyu.developer_events(at,source,name,level,status) SELECT '2026-01-02T08:00:00Z','request','asset','error',502 FROM generate_series(1,32)");
 const data=await service.events(new URLSearchParams('date=2026-01-02&levels=warning,error&type=request'));
 assert.equal(data.items.length,30);assert.equal(data.hasNext,true);assert.equal(data.summary.total,34);assert.deepEqual(data.summary.sources,[{id:'request',count:34}]);
 assert.deepEqual(data.summary.interfaces,[{id:'asset',count:33},{id:'pdf',count:1}]);assert.equal(data.summary.levels.error,33);assert.equal(data.summary.levels.warning,1);
 const page2=await service.events(new URLSearchParams('date=2026-01-02&levels=warning,error&type=request&page=2'));assert.equal(page2.items.length,4);assert.equal(page2.summary.total,34);
 const empty=await service.events(new URLSearchParams('date=2026-01-02&type=notification'));assert.equal(empty.summary.total,0);assert.equal(empty.items.length,0);
});
test('overview charts derive response extremes and daily averages from measured requests',async()=>{
 await fixture.pool.query('TRUNCATE juyu.developer_events');
 await fixture.pool.query("INSERT INTO juyu.developer_events(source,name,level,status,duration_ms) VALUES('request','asset','info',200,10),('request','pdf','info',200,30),('request','asset','error',502,80)");
 const data=await service.overview(7);assert.equal(data.requests.count,3);assert.equal(data.requests.failed,1);assert.equal(data.requests.minimumMs,10);assert.equal(data.requests.maximumMs,80);assert.equal(data.requests.averageMs,40);
 assert.equal(data.timeline.length,7);assert.equal(data.timeline.at(-1)?.averageMs,40);assert.equal(data.timeline[0].averageMs,null);assert.equal(data.notificationTimeline.length,7);assert.ok(data.notificationTimeline.every(x=>x.sent===0&&x.failed===0&&x.pending===0));
});

test('article rankings use the latest matching audit title rather than alphabetic maximum',async()=>{
 const viewer={id:'s',role:'super_admin' as const,companyVerified:true as const};const A=new AuthorizationService(new ScopedDatabase(runtime,issuer),async()=>viewer),id=randomUUID();
 const fields={kind:'article' as const,audience:'staff' as const,tags:[],cover:null,body:encodeEditorBody([{id:'p',type:'paragraph',content:[{type:'text',text:'正文',styles:{}}]}])};
 const old=await A.saveDraft(id,{...fields,expectedSequence:null,title:'Z old title'});await A.saveDraft(id,{...fields,expectedSequence:old.sequence,title:'A current title'});
 const result=await service.events(new URLSearchParams({q:id,source:'audit'}));assert.equal(result.summary.articles[0].title,'A current title');assert.equal(result.summary.articles[0].count,2);
});
