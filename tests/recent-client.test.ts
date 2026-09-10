import {test} from 'node:test';import assert from 'node:assert/strict';import {recordRecentView} from '../src/recent/client.ts';
test('recent client records only the publication revision without client identity or timestamp',async()=>{
 const old=globalThis.fetch;let call:{url:string;init?:RequestInit}|undefined;globalThis.fetch=async(url,init)=>{call={url:String(url),init};return Response.json({documentId:'a/b',revision:3,viewedAt:'2026-09-09T01:00:00.000Z'});};
 try{const result=await recordRecentView('a/b',3);assert.equal(result.revision,3);assert.equal(call?.url,'/api/recent/a%2Fb');assert.equal(call?.init?.method,'POST');assert.equal(call?.init?.credentials,'same-origin');assert.deepEqual(JSON.parse(String(call?.init?.body)),{revision:3});}finally{globalThis.fetch=old;}
});
test('recent client never accepts mismatched or malformed recording acknowledgements',async()=>{
 const old=globalThis.fetch;try{for(const patch of [{documentId:'other'},{revision:4},{viewedAt:'invalid'},{viewedAt:null}]){globalThis.fetch=async()=>Response.json({documentId:'a',revision:3,viewedAt:'2026-09-09T01:00:00.000Z',...patch});await assert.rejects(recordRecentView('a',3),/INVALID_ACK/);}}finally{globalThis.fetch=old;}
});
test('recent client surfaces unavailable recording and never treats rejection as success',async()=>{
 const old=globalThis.fetch;try{for(const status of [403,409,503]){globalThis.fetch=async()=>Response.json({error:status===409?'VERSION_CHANGED':'SQL details'},{status});await assert.rejects(recordRecentView('a',3),new RegExp(status===409?'VERSION_CHANGED':'RECORD_UNCONFIRMED'));}}finally{globalThis.fetch=old;}
});
