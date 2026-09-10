import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readCategories, saveCategory, CategoryWriteRejected} from '../src/categories/client.ts';
const id = '11111111-1111-4111-8111-111111111111';
const write = {expectedVersion:null, name:'项目名称', parentId:null, position:0, audience:'staff' as const, enabled:true};
const definition = {id, version:1, name:write.name, parentId:null, position:0, audience:write.audience, enabled:true};
test('category settings reads uncached definitions and sends a stable caller id with optimistic version', async () => {
 const original=globalThis.fetch; const calls:{url:string;init?:RequestInit}[]=[];
 globalThis.fetch=async(url,init)=>{calls.push({url:String(url),init});return Response.json(init?.method==='PUT'?definition:[definition]);};
 try {assert.deepEqual(await readCategories(),[definition]);assert.deepEqual(await saveCategory(id,write),definition);assert.equal(calls[0].init?.cache,'no-store');assert.equal(calls[1].url,`/api/admin/categories/${id}`);assert.equal(calls[1].init?.credentials,'same-origin');assert.deepEqual(JSON.parse(String(calls[1].init?.body)),write);}finally{globalThis.fetch=original;}
});
test('category acknowledgement must match every submitted value and the exact next version', async()=>{
 const original=globalThis.fetch;
 try{for(const patch of [{id:'22222222-2222-4222-8222-222222222222'},{version:2},{enabled:false},{position:7},{name:'其他'},{audience:'admin'},{parentId:'22222222-2222-4222-8222-222222222222'}]){globalThis.fetch=async()=>Response.json({...definition,...patch});await assert.rejects(saveCategory(id,write),e=>e instanceof Error&&!(e instanceof CategoryWriteRejected)&&e.message==='INVALID_ACK');}}finally{globalThis.fetch=original;}
});
test('unknown category write can retry the identical id, version and payload', async()=>{
 const original=globalThis.fetch;const payloads:string[]=[];let attempt=0;
 globalThis.fetch=async(url,init)=>{payloads.push(`${url} ${init?.body}`);if(attempt++===0)throw new Error('network');return Response.json(definition);};
 try{await assert.rejects(saveCategory(id,write),e=>e instanceof Error&&!(e instanceof CategoryWriteRejected));assert.deepEqual(await saveCategory(id,write),definition);assert.equal(payloads[0],payloads[1]);}finally{globalThis.fetch=original;}
});
test('explicit category rejection stays distinct from server failure and malformed success',async()=>{
 const original=globalThis.fetch;
 try{globalThis.fetch=async()=>Response.json({error:'VERSION_CONFLICT'},{status:409});await assert.rejects(saveCategory(id,write),CategoryWriteRejected);globalThis.fetch=async()=>new Response('rejected',{status:403});await assert.rejects(saveCategory(id,write),CategoryWriteRejected);for(const response of [new Response('broken',{status:200}),Response.json({error:'UNAVAILABLE'},{status:503})]){globalThis.fetch=async()=>response;await assert.rejects(saveCategory(id,write),e=>e instanceof Error&&!(e instanceof CategoryWriteRejected));}}finally{globalThis.fetch=original;}
});
test('category reads reject malformed, duplicate and over-capacity definitions',async()=>{
 const original=globalThis.fetch;
 try{for(const result of [{fields:[definition]},[definition,definition],[{...definition,version:0}],[{...definition,enabled:'true'}],[{...definition,audience:'unknown'}],[{...definition,position:-1}],Array.from({length:101},(_,i)=>({...definition,id:`11111111-1111-4111-8111-${String(i).padStart(12,'0')}`}))]){globalThis.fetch=async()=>Response.json(result);await assert.rejects(readCategories(),/INVALID_ACK/);}}finally{globalThis.fetch=original;}
});
test('invalid category writes are rejected before a request is sent',async()=>{
 const original=globalThis.fetch;let called=false;globalThis.fetch=async()=>{called=true;return Response.json(definition);};
 try{await assert.rejects(saveCategory(id,{...write,name:''}),CategoryWriteRejected);await assert.rejects(saveCategory('bad/id',write),CategoryWriteRejected);assert.equal(called,false);}finally{globalThis.fetch=original;}
});
test('child acknowledgement validates independently of its parent and normalizes the submitted name',async()=>{
 const original=globalThis.fetch;
 const parentId='22222222-2222-4222-8222-222222222222';
 globalThis.fetch=async()=>Response.json({...definition,parentId,name:'子分类',version:5});
 try{assert.deepEqual(await saveCategory(id,{...write,parentId,name:' 子分类 ',expectedVersion:4}),{...definition,parentId,name:'子分类',version:5});}finally{globalThis.fetch=original;}
});
test('category read errors never become successful empty lists',async()=>{
 const original=globalThis.fetch;
 try{for(const status of [403,503]){globalThis.fetch=async()=>Response.json({error:'unavailable'},{status});await assert.rejects(readCategories(),new RegExp(status===403?'FORBIDDEN':'CATEGORIES_UNAVAILABLE'));}}finally{globalThis.fetch=original;}
});
