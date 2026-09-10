import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFormSettings,saveForm,FormWriteRejected} from '../src/forms/settings-client.ts';
import type {FieldDefinition} from '../src/fields/model.ts';
const id='11111111-1111-4111-8111-111111111111';
const field:FieldDefinition={id:'22222222-2222-4222-8222-222222222222',version:2,name:'所属团队',type:'select',required:false,enabled:true,options:['运营','客服']};
const write={expectedVersion:null,title:'工作申请',description:'提交后由管理员处理。',audience:'staff' as const,enabled:false,fields:[{id:field.id,version:2,required:true,width:'half' as const}]};
const form={id,version:1,title:write.title,description:write.description,audience:write.audience,enabled:false,fields:[{field,required:true,width:'half'}]};
test('form settings reads both uncached resources and returns only the complete pair',async()=>{
 const original=globalThis.fetch;const calls:{url:string;init?:RequestInit}[]=[];
 globalThis.fetch=async(url,init)=>{calls.push({url:String(url),init});return Response.json(String(url).endsWith('/fields')?[field]:[form]);};
 try{assert.deepEqual(await readFormSettings(),{forms:[form],definitions:[field]});assert.equal(calls.length,2);assert(calls.every(call=>call.init?.cache==='no-store'&&call.init.credentials==='same-origin'));}finally{globalThis.fetch=original;}
});
test('form acknowledgement verifies config, ordered bindings and full chosen field snapshots',async()=>{
 const original=globalThis.fetch;
 const variants=[{version:2},{id:field.id},{title:'其他'},{description:'不同说明'},{audience:'admin'},{enabled:true},{fields:[{...form.fields[0],required:false}]},{fields:[{...form.fields[0],width:'full'}]},...([{name:'伪造名称'},{version:3},{id},{enabled:false},{required:true},{options:['其他选项']}].map(patch=>({fields:[{...form.fields[0],field:{...field,...patch}}]})))];
 try{for(const patch of variants){globalThis.fetch=async()=>Response.json({...form,...patch});await assert.rejects(saveForm(id,write,[field]),error=>error instanceof Error&&!(error instanceof FormWriteRejected)&&error.message==='INVALID_ACK');}}finally{globalThis.fetch=original;}
});
test('unknown form save retries identical stable identifier and original binding versions',async()=>{
 const original=globalThis.fetch;const calls:string[]=[];let attempt=0;
 globalThis.fetch=async(url,init)=>{calls.push(`${url} ${init?.body}`);if(attempt++===0)throw new Error('network');return Response.json(form);};
 try{await assert.rejects(saveForm(id,write,[field]),error=>error instanceof Error&&!(error instanceof FormWriteRejected));assert.deepEqual(await saveForm(id,write,[field]),form);assert.equal(calls[0],calls[1]);assert.deepEqual(JSON.parse(calls[1].slice(calls[1].indexOf(' ')+1)),write);}finally{globalThis.fetch=original;}
});
test('definite form and field conflicts differ from unknown result and malformed acknowledgements',async()=>{
 const original=globalThis.fetch;
 try{for(const code of ['FORM_CONFLICT','FIELD_CONFLICT','FORM_LIMIT','INVALID_INPUT','FORBIDDEN']){globalThis.fetch=async()=>Response.json({error:code},{status:409});await assert.rejects(saveForm(id,write,[field]),error=>error instanceof FormWriteRejected&&error.message===code);}for(const response of [new Response('broken',{status:200}),new Response('unavailable',{status:503})]){globalThis.fetch=async()=>response;await assert.rejects(saveForm(id,write,[field]),error=>error instanceof Error&&!(error instanceof FormWriteRejected));}}finally{globalThis.fetch=original;}
});
test('invalid request or untrusted chosen snapshots are rejected before fetch',async()=>{
 const original=globalThis.fetch;let called=false;globalThis.fetch=async()=>{called=true;return Response.json(form);};
 try{for(const [formId,input,snapshots] of [[id,{...write,title:''},[field]],['bad',write,[field]],[id,write,[]],[id,write,[{...field,version:3}]]] as const){await assert.rejects(saveForm(formId,input,[...snapshots]),FormWriteRejected);}assert.equal(called,false);}finally{globalThis.fetch=original;}
});
test('one unavailable or malformed resource rejects the entire settings reload',async()=>{
 const original=globalThis.fetch;
 try{for(const failedResource of ['/forms','/fields']){globalThis.fetch=async(url)=>String(url).endsWith(failedResource)?new Response('unavailable',{status:503}):Response.json(String(url).endsWith('/fields')?[field]:[form]);await assert.rejects(readFormSettings());}globalThis.fetch=async(url)=>Response.json(String(url).endsWith('/fields')?[{...field,version:0}]:[form]);await assert.rejects(readFormSettings());}finally{globalThis.fetch=original;}
});
test('old retained snapshots acknowledge unchanged even if the global field has since changed',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({...form,enabled:false,version:6});
 try{assert.equal((await saveForm(id,{...write,expectedVersion:5},[field])).version,6);}finally{globalThis.fetch=original;}
});
test('acknowledgement cannot silently reverse the configured field order',async()=>{
 const original=globalThis.fetch;
 const second:FieldDefinition={...field,id:'33333333-3333-4333-8333-333333333333',name:'申请说明',type:'text',options:[]};
 const input={...write,fields:[...write.fields,{id:second.id,version:2,required:false,width:'full' as const}]};
 globalThis.fetch=async()=>Response.json({...form,fields:[{field:second,required:false,width:'full'},form.fields[0]]});
 try{await assert.rejects(saveForm(id,input,[field,second]),error=>error instanceof Error&&!(error instanceof FormWriteRejected)&&error.message==='INVALID_ACK');}finally{globalThis.fetch=original;}
});
