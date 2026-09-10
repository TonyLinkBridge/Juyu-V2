import test from 'node:test';
import assert from 'node:assert/strict';
const snapshot={documentId:'history-local',sequence:9,currentRevision:3,publishedRevision:2,lifecycle:'active',status:'draft',version:{revision:1,title:'历史标题',authorId:'author',authorName:'原作者',editorId:'editor',editorName:'原编辑',createdAt:'2026-09-01T00:00:00Z',body:'# 历史正文',audience:'staff',tags:['流程'],cover:null,blocks:[]},categories:[{id:'category',name:'客服'}],assets:[],canRestore:true};
test('restore acknowledges only the exact source new draft version sequence and unchanged formal pointer',async()=>{
 const m=await import('../src/history/client.ts'),old=globalThis.fetch,input={expectedSequence:9,sourceRevision:1};
 const ack={documentId:'history-local',sequence:10,revision:4,sourceRevision:1,status:'draft',publishedRevision:2};
 try{let request:RequestInit|undefined,url='';globalThis.fetch=async(u,i)=>{url=String(u);request=i;return Response.json(ack);};assert.deepEqual(await m.restoreHistoryVersion('history-local',input,3,2),ack);assert.equal(url,'/api/admin/history/history-local/versions/1');assert.deepEqual(JSON.parse(String(request?.body)),input);
 for(const patch of [{documentId:'other'},{sequence:11},{revision:3},{sourceRevision:2},{status:'approved'},{publishedRevision:null}]){globalThis.fetch=async()=>Response.json({...ack,...patch});await assert.rejects(m.restoreHistoryVersion('history-local',input,3,2),/INVALID_ACK/);}
 }finally{globalThis.fetch=old;}
});
test('known rejection is refreshable while malformed responses server failures and timeout remain unknown',async()=>{
 const m=await import('../src/history/client.ts'),old=globalThis.fetch,input={expectedSequence:9,sourceRevision:1};try{
 for(const code of ['CONFLICT','MEMBER_BUSY','UPLOAD_IN_PROGRESS','FORBIDDEN','INVALID_STATE','SOURCE_ASSET_UNAVAILABLE','INVALID_MEDIA','INVALID_COVER']){globalThis.fetch=async()=>Response.json({error:code},{status:409});await assert.rejects(m.restoreHistoryVersion('history-local',input,3,2),m.HistoryRestoreRejected);}
 for(const response of [()=>Response.json({error:'FAILED'},{status:503}),()=>new Response('bad',{status:409}),()=>Response.json({})]){globalThis.fetch=async()=>response();await assert.rejects(m.restoreHistoryVersion('history-local',input,3,2),e=>!(e instanceof m.HistoryRestoreRejected));}
 globalThis.fetch=async()=>{throw new TypeError('fetch failed');};await assert.rejects(m.restoreHistoryVersion('history-local',input,3,2),e=>!(e instanceof m.HistoryRestoreRejected));
 assert.match(m.historyRestoreError(new m.HistoryRestoreRejected('MEMBER_BUSY')),/未执行/);for(const code of ['INVALID_MEDIA','INVALID_COVER'])assert.match(m.historyRestoreError(new m.HistoryRestoreRejected(code)),/来源版本有文件无法读取/);assert.match(m.historyRestoreError(new Error('INVALID_ACK')),/原操作/);
 }finally{globalThis.fetch=old;}
});
test('selected history refresh validates freshness source identity all metadata and actual restore eligibility',async()=>{
 const m=await import('../src/history/client.ts'),old=globalThis.fetch;try{let cache:RequestCache|undefined;globalThis.fetch=async(_,i)=>{cache=i?.cache;return Response.json(snapshot);};assert.deepEqual(await m.readHistoryVersion('history-local',1,9,3),snapshot);assert.equal(cache,'no-store');
 for(const patch of [{sequence:8},{currentRevision:2},{publishedRevision:4},{documentId:'other'},{lifecycle:'purged'},{status:'in_review'},{lifecycle:'archived'},{version:{...snapshot.version,revision:2}},{version:{...snapshot.version,body:42}},{version:{...snapshot.version,blocks:[{}]}},{categories:[{}]},{assets:[{}]},{assets:[{id:'a',filename:'x',mime:'image/png',size:'2',status:'quarantined'}]}]){globalThis.fetch=async()=>Response.json({...snapshot,...patch});await assert.rejects(m.readHistoryVersion('history-local',1,9,3),/READ_FAILED/);}
 globalThis.fetch=async()=>Response.json({...snapshot,status:'in_review',canRestore:false});assert.equal((await m.readHistoryVersion('history-local',1,9,3)).canRestore,false);
 }finally{globalThis.fetch=old;}
});
