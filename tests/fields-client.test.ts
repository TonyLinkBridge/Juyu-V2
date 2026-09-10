import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFields, saveField, FieldWriteRejected} from '../src/fields/client.ts';
const id = '11111111-1111-4111-8111-111111111111';
const write = {expectedVersion:null, name:'项目名称', type:'text' as const, required:false, options:[], enabled:true};
const definition = {id, version:1, name:write.name, type:write.type, required:false, options:[], enabled:true};
test('field settings reads uncached definitions and sends a stable caller id with optimistic version', async () => {
 const original=globalThis.fetch; const calls:{url:string;init?:RequestInit}[]=[];
 globalThis.fetch=async(url,init)=>{calls.push({url:String(url),init});return Response.json(init?.method==='PUT'?definition:[definition]);};
 try {assert.deepEqual(await readFields(),[definition]);assert.deepEqual(await saveField(id,write),definition);assert.equal(calls[0].init?.cache,'no-store');assert.equal(calls[1].url,`/api/admin/fields/${id}`);assert.equal(calls[1].init?.credentials,'same-origin');assert.deepEqual(JSON.parse(String(calls[1].init?.body)),write);}finally{globalThis.fetch=original;}
});
test('field acknowledgement must match every submitted value and the exact next version', async()=>{
 const original=globalThis.fetch;
 try{for(const patch of [{id:'22222222-2222-4222-8222-222222222222'},{version:2},{enabled:false},{required:true},{name:'其他'},{type:'boolean'},{options:['unexpected']}]){globalThis.fetch=async()=>Response.json({...definition,...patch});await assert.rejects(saveField(id,write),e=>e instanceof Error&&!(e instanceof FieldWriteRejected)&&e.message==='INVALID_ACK');}}finally{globalThis.fetch=original;}
});
test('field acknowledgement normalizes submitted names and options before comparison', async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({...definition,name:'团队',type:'select',options:['市场','产品'],version:5});
 try{const result=await saveField(id,{...write,expectedVersion:4,name:' 团队 ',type:'select',options:[' 市场 ','产品']});assert.equal(result.version,5);assert.deepEqual(result.options,['市场','产品']);}finally{globalThis.fetch=original;}
});
test('unknown field write can retry the identical id, version and payload', async()=>{
 const original=globalThis.fetch;const payloads:string[]=[];let attempt=0;
 globalThis.fetch=async(url,init)=>{payloads.push(`${url} ${init?.body}`);if(attempt++===0)throw new Error('network');return Response.json(definition);};
 try{await assert.rejects(saveField(id,write),e=>e instanceof Error&&!(e instanceof FieldWriteRejected));assert.deepEqual(await saveField(id,write),definition);assert.equal(payloads[0],payloads[1]);}finally{globalThis.fetch=original;}
});
test('explicit field rejection stays distinct from server failure and malformed success',async()=>{
 const original=globalThis.fetch;
 try{globalThis.fetch=async()=>Response.json({error:'VERSION_CONFLICT'},{status:409});await assert.rejects(saveField(id,write),FieldWriteRejected);globalThis.fetch=async()=>new Response('rejected',{status:403});await assert.rejects(saveField(id,write),FieldWriteRejected);for(const response of [new Response('broken',{status:200}),Response.json({error:'UNAVAILABLE'},{status:503})]){globalThis.fetch=async()=>response;await assert.rejects(saveField(id,write),e=>e instanceof Error&&!(e instanceof FieldWriteRejected));}}finally{globalThis.fetch=original;}
});
test('field reads reject malformed, duplicate and over-capacity definitions',async()=>{
 const original=globalThis.fetch;
 try{for(const result of [{fields:[definition]},[definition,definition],[{...definition,version:0}],[{...definition,enabled:'true'}],[{...definition,type:'unknown'}],[{...definition,options:['unexpected']}],Array.from({length:31},(_,i)=>({...definition,id:`11111111-1111-4111-8111-${String(i).padStart(12,'0')}`}))]){globalThis.fetch=async()=>Response.json(result);await assert.rejects(readFields(),/INVALID_ACK/);}}finally{globalThis.fetch=original;}
});
test('invalid field writes are rejected before a request is sent',async()=>{
 const original=globalThis.fetch;let called=false;globalThis.fetch=async()=>{called=true;return Response.json(definition);};
 try{await assert.rejects(saveField(id,{...write,name:''}),FieldWriteRejected);await assert.rejects(saveField('bad/id',write),FieldWriteRejected);assert.equal(called,false);}finally{globalThis.fetch=original;}
});
