import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseHistoryQuery,parseHistoryTarget,parseRestore,normalizeHistoryPage,normalizeHistoryDetail,normalizeRestoreAck,configRows} from '../src/setting-history/model.ts';
import {defaultFeatureFlags} from '../src/features/model.ts';
const id='00000000-0000-4000-8000-000000000001',target={kind:'features' as const,id,version:1},input={...target,expectedVersion:2,requestId:id};
test('history targets and restoration accept only bounded fixed identifiers without client configuration',()=>{
 assert.deepEqual(parseHistoryQuery(new URLSearchParams()),{kind:'all',page:1});assert.throws(()=>parseHistoryQuery(new URLSearchParams('page=0')));assert.throws(()=>parseHistoryQuery(new URLSearchParams('kind=members')));assert.deepEqual(parseHistoryTarget(target),target);assert.deepEqual(parseRestore(input),input);
 for(const x of [{...input,config:{}},{...input,kind:'sql'},{...input,version:2},{...input,id:'../x'},{...input,expectedVersion:2147483647}])assert.throws(()=>parseRestore(x));
});
test('history envelopes reject missing before evidence, inconsistent pagination and mismatched recovery receipts',()=>{
 const entry={...target,label:'功能开关',actor:{id:'a',name:'Admin'},changedAt:'2026-09-10T00:00:00.000Z',restoredFrom:null};
 assert.equal(normalizeHistoryPage({items:[entry],total:1,page:1,pages:1}).items.length,1);
 assert.throws(()=>normalizeHistoryPage({items:[],total:1,page:1,pages:1}));
 const detail={entry,before:{flags:defaultFeatureFlags},after:{flags:{...defaultFeatureFlags,search:false}},current:{version:2,config:{flags:defaultFeatureFlags}}};
 assert.equal(normalizeHistoryDetail(detail).current.version,2);assert.throws(()=>normalizeHistoryDetail({...detail,before:undefined}));
 const ack={...input,newVersion:3};assert.deepEqual(normalizeRestoreAck(ack),ack);assert.throws(()=>normalizeRestoreAck({...ack,newVersion:4}));
 assert.ok(configRows('features',detail.after).some(x=>x.label==='资料搜索'&&x.value==='关闭'));
});

import {loadHistory,loadHistoryDetail,restoreHistory,HistoryRejected} from '../src/setting-history/client.ts';
import {historyResponse,readHistoryBody} from '../src/server/setting-history/http.ts';
test('client rejects mismatched detail and write acknowledgements, keeping exact retry inputs',async()=>{
 const original=globalThis.fetch;try{
  globalThis.fetch=async()=>Response.json({result:{...input,newVersion:3,requestId:'00000000-0000-4000-8000-000000000002'}});await assert.rejects(restoreHistory(input),/INVALID_ACK/);
  globalThis.fetch=async()=>Response.json({result:{...input,newVersion:3}});assert.equal((await restoreHistory(input)).newVersion,3);
  globalThis.fetch=async()=>new Response('',{status:409});await assert.rejects(restoreHistory(input),HistoryRejected);
  globalThis.fetch=async()=>new Response('',{status:503});await assert.rejects(restoreHistory(input),/UNKNOWN_RESULT/);
  globalThis.fetch=async()=>Response.json({result:{items:[],total:0,page:1,pages:1},extra:true});await assert.rejects(loadHistory('all',1));
  const e={...target,id:'00000000-0000-4000-8000-000000000002',label:'功能开关',actor:null,changedAt:'2026-09-10T00:00:00Z',restoredFrom:null};
  globalThis.fetch=async()=>Response.json({result:{entry:e,before:null,after:{flags:defaultFeatureFlags},current:{version:1,config:{flags:defaultFeatureFlags}}}});await assert.rejects(loadHistoryDetail(target),/INVALID_ACK/);
 }finally{globalThis.fetch=original;}
});
test('history HTTP keeps unavailable distinct and rejects unsafe or overlong restore payloads',async()=>{
 for(const [error,status] of [['FORBIDDEN',403],['HISTORY_CONFLICT',409],['CATEGORY_CYCLE',409],['FEATURE_DISABLED',403],['NOT_FOUND',404],['INVALID_INPUT',400],['secret connection error',503]] as const){const r=await historyResponse(async()=>{throw new Error(error);});assert.equal(r.status,status);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('vary'),'Cookie, Authorization');if(status===503)assert.deepEqual(await r.json(),{error:'HISTORY_UNAVAILABLE'});}
 await assert.rejects(readHistoryBody(new Request('http://localhost/api',{method:'POST',headers:{origin:'https://other.test','content-type':'application/json'},body:'{}'})));
 await assert.rejects(readHistoryBody(new Request('http://localhost/api',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:' '.repeat(5000)})));
});
