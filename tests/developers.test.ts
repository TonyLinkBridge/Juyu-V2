import {test} from 'node:test';
import assert from 'node:assert/strict';
import {csvField,integrationCatalog,parseEventFilter,safeTelemetry,notificationState} from '../src/developers/model.ts';
import {developerOnly} from '../src/server/developers/guard.ts';
import {observeRequest} from '../src/server/developers/telemetry.ts';

test('integration metadata never exposes secret values and does not claim connectivity',()=>{
 const data=integrationCatalog({CLERK_SECRET_KEY:'sk_live_SECRET',NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:'pk_live_SECRET',SUPABASE_SERVICE_ROLE_KEY:'storage-SECRET',NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',SLACK_BOT_TOKEN:'xoxb-SECRET',SLACK_NOTIFICATION_CHANNEL_ID:'C123456789',ALLOWED_SLACK_TEAM_ID:'T123456789',APP_ORIGIN:'https://example.test',CRON_SECRET:'a'.repeat(32),VERCEL_ENV:'production'});
 assert.equal(data.length,5);for(const secret of ['sk_live_SECRET','pk_live_SECRET','storage-SECRET','xoxb-SECRET'])assert.ok(!JSON.stringify(data).includes(secret));
 assert.equal(data.find(x=>x.id==='slack')?.configuration,'present');assert.equal(data.find(x=>x.id==='slack')?.check,'not_checked');
 assert.equal(integrationCatalog({}).find(x=>x.id==='slack')?.configuration,'missing');
});
test('Super Admin guard rejects ordinary admins and unavailable sessions without running work',async()=>{
 let calls=0;for(const role of ['support','ops','admin'] as const){const response=await developerOnly(async()=>({status:'ready',sessionId:'test',viewer:{id:'u',companyVerified:true,role}}),async()=>{calls++;return {secret:'never'};});assert.equal(response.status,403);}
 const expired=await developerOnly(async()=>({status:'signed_out'}),async()=>{calls++;return {};});assert.equal(expired.status,401);
 const down=await developerOnly(async()=>{throw new Error('TOKEN_SECRET');},async()=>{calls++;return {};});assert.equal(down.status,503);assert.ok(!(await down.text()).includes('TOKEN_SECRET'));assert.equal(calls,0);
 const viewer={id:'s',companyVerified:true as const,role:'super_admin' as const};const allowed=await developerOnly(async()=>({status:'ready',sessionId:'test',viewer}),async()=>({ok:true}));assert.equal(allowed.status,200);assert.equal(allowed.headers.get('cache-control'),'private, no-store');
});
test('filters validate bounded paging and supported sources/levels',()=>{
 assert.deepEqual(parseEventFilter(new URLSearchParams('q=publish&days=7&source=slack&level=error&page=2')),{q:'publish',days:7,source:'slack',level:'error',page:2});
 for(const query of ['page=-1','days=400','source=evil','level=fatal','q='+ 'a'.repeat(121),'page=1&page=2','unknown=1'])assert.throws(()=>parseEventFilter(new URLSearchParams(query)),/INVALID_INPUT/);
});
test('custom log dates and multiple severity filters validate real calendar days',()=>{
 const filter=parseEventFilter(new URLSearchParams('date=2026-10-04&levels=warning,error&type=request'));
 assert.equal(filter.date,'2026-10-04');assert.deepEqual(filter.levels,['warning','error']);assert.equal(filter.type,'request');
 for(const q of ['date=2026-02-30','date=2026-13-01','date=2026-10-04T00:00:00Z','levels=error,error','levels=error,fatal','levels=error&level=warning','type=evil'])assert.throws(()=>parseEventFilter(new URLSearchParams(q)),/INVALID_INPUT/);
});
test('request observation preserves response and failure despite a broken recorder',async()=>{
 const rows:unknown[]=[];const response=new Response('private body',{status:502});
 assert.equal(await observeRequest('asset',async()=>response,event=>{rows.push(event);}),response);
 assert.deepEqual(rows,[{source:'request',name:'asset',status:502,durationMs:0,level:'error'}].map(x=>({...x,durationMs:(rows[0] as {durationMs:number}).durationMs})));
 assert.ok(!JSON.stringify(rows).includes('private'));assert.ok(safeTelemetry(rows[0]));
 assert.equal(await observeRequest('pdf',async()=>new Response(),()=>{throw new Error('recorder failure');}).then(r=>r.status),200);
 await assert.rejects(observeRequest('publication',async()=>{throw new Error('private exception');},()=>{throw Error('log failed');}),/private exception/);
 assert.equal(safeTelemetry({source:'request',name:'asset',status:200,durationMs:5,level:'info',body:'SECRET'}),null);
});
test('notification status distinguishes delivered, active lease, retry and waiting',()=>{
 const now=Date.parse('2026-10-02T12:00:00Z');
 assert.equal(notificationState({sentAt:'2026-10-02T11:00:00Z',leaseUntil:null,lastError:null},now),'sent');
 assert.equal(notificationState({sentAt:null,leaseUntil:'2026-10-02T12:01:00Z',lastError:'timeout'},now),'sending');
 assert.equal(notificationState({sentAt:null,leaseUntil:null,lastError:'timeout'},now),'failed');
 assert.equal(notificationState({sentAt:null,leaseUntil:null,lastError:null},now),'pending');
});

import {probeIntegration} from '../src/server/developers/probes.ts';
test('connection probes verify private bucket and approved Slack workspace without returning provider data',async()=>{
 const env={NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'SECRET',SLACK_BOT_TOKEN:'xoxb-SECRET',SLACK_NOTIFICATION_CHANNEL_ID:'C123456789',ALLOWED_SLACK_TEAM_ID:'T123456789',APP_ORIGIN:'https://example.test'};
 const fetcher:typeof fetch=async input=>String(input).includes('slack.com')?Response.json({ok:true,team_id:'T999999999',bot_id:'B123456789',privateValue:'SECRET'}):Response.json({id:'juyu-private',public:true,privateValue:'SECRET'});
 const deps={fetcher,readiness:async()=>({authentication:'ok',database:'ok'})};
 const storage=await probeIntegration('storage',env,deps);assert.equal(storage.check,'failed');assert.equal(storage.code,'PRIVATE_BUCKET_REQUIRED');
 const slack=await probeIntegration('slack',env,deps);assert.equal(slack.check,'failed');assert.equal(slack.code,'SLACK_WORKSPACE_MISMATCH');assert.ok(!JSON.stringify([slack,storage]).includes('SECRET'));
 const missing=await probeIntegration('slack',{},deps);assert.equal(missing.configuration,'missing');assert.equal(missing.check,'not_checked');
 const ok=await probeIntegration('slack',env,{...deps,fetcher:async()=>Response.json({ok:true,team_id:'T123456789',bot_id:'B123456789'})});assert.equal(ok.check,'ok');assert.equal(ok.scope,'bot_identity_only');
});

test('diagnostics and telemetry reject arbitrary content, and probes reject redirects and invalid origins',async()=>{
 assert.equal(safeTelemetry({source:'connection',name:'slack',level:'error',code:'SECRET'}),null);
 assert.equal(safeTelemetry({source:'request',name:'asset',level:'info',actorId:'person'}),null);
 assert.equal(safeTelemetry({source:'publication-client',name:'blocked',level:'warning',diagnostic:{attempt:'bad',stage:'blocked',reason:'uploading',sequence:1,online:true}}),null);
 let calls=0;const result=await probeIntegration('storage',{NEXT_PUBLIC_SUPABASE_URL:'https://example.test/extra',SUPABASE_SERVICE_ROLE_KEY:'SECRET'},{fetcher:async()=>{calls++;return Response.json({});},readiness:async()=>({authentication:'ok',database:'ok'})});assert.equal(result.check,'failed');assert.equal(calls,0);
 const cron=await probeIntegration('cron',{CRON_SECRET:'SECRET'},{fetcher:fetch,readiness:async()=>({authentication:'ok',database:'ok'})});assert.equal(cron.check,'unsupported');
});

test('CSV fields retain quotes and commas without executing spreadsheet formulas',()=>{
 assert.equal(csvField('Haley, "Super"'),'"Haley, ""Super"""');
 for(const value of ['=1+1',' +SUM(A1)','-1+1','@SUM(A1)','\t=1','\n=1'])assert.equal(csvField(value),'"\''+value+'"');
 assert.equal(csvField('正常文章'),'"正常文章"');
});
