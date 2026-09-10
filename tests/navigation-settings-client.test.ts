import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readNavigationSettings,saveNavigationSettings,NavigationWriteRejected} from '../src/navigation-settings/client.ts';
import type {NavigationEntry} from '../src/navigation-settings/model.ts';
const entry:NavigationEntry={id:'11111111-1111-4111-8111-111111111111',label:'帮助中心',enabled:true,roles:['support','ops','admin'],target:{type:'page',page:'home'}};
const category={id:'22222222-2222-4222-8222-222222222222',version:1,name:'团队资料',parentId:null,position:0,audience:'staff',enabled:true};
const write={expectedVersion:0,entries:[entry]};
const config={version:1,entries:[entry]};
test('navigation settings reads complete uncached config and current categories together',async()=>{
 const original=globalThis.fetch;const calls:{url:string;init?:RequestInit}[]=[];
 globalThis.fetch=async(url,init)=>{calls.push({url:String(url),init});return Response.json(String(url).endsWith('/categories')?[category]:{config});};
 try{assert.deepEqual(await readNavigationSettings(),{config,categories:[category]});assert.equal(calls.length,2);assert(calls.every(call=>call.init?.cache==='no-store'&&call.init.credentials==='same-origin'));}finally{globalThis.fetch=original;}
});
test('navigation save requires strict wrapper, exact next version and every entry property',async()=>{
 const original=globalThis.fetch;
 const variants=[{version:2},{entries:[{...entry,id:category.id}]},{entries:[{...entry,label:'其他'}]},{entries:[{...entry,enabled:false}]},{entries:[{...entry,roles:['admin']}]},{entries:[{...entry,target:{type:'page',page:'ops'}}]},{entries:[]}];
 try{for(const patch of variants){globalThis.fetch=async()=>Response.json({config:{...config,...patch}});await assert.rejects(saveNavigationSettings(write),e=>e instanceof Error&&!(e instanceof NavigationWriteRejected)&&e.message==='INVALID_ACK');}for(const value of [config,{config,extra:'unexpected'}]){globalThis.fetch=async()=>Response.json(value);await assert.rejects(saveNavigationSettings(write),/INVALID_ACK/);}}finally{globalThis.fetch=original;}
});
test('unknown navigation writes retry the identical complete config and version',async()=>{
 const original=globalThis.fetch;const calls:string[]=[];let count=0;
 globalThis.fetch=async(url,init)=>{calls.push(`${url} ${init?.body}`);if(count++===0)throw new Error('network');return Response.json({config});};
 try{await assert.rejects(saveNavigationSettings(write),e=>e instanceof Error&&!(e instanceof NavigationWriteRejected));assert.deepEqual(await saveNavigationSettings(write),config);assert.equal(calls[0],calls[1]);}finally{globalThis.fetch=original;}
});
test('navigation acknowledgement cannot change entry order or return noncanonical roles',async()=>{
 const original=globalThis.fetch;const second:NavigationEntry={...entry,id:category.id,label:'收藏',target:{type:'page',page:'favorites'}};
 try{globalThis.fetch=async()=>Response.json({config:{version:1,entries:[second,entry]}});await assert.rejects(saveNavigationSettings({expectedVersion:0,entries:[entry,second]}),/INVALID_ACK/);globalThis.fetch=async()=>Response.json({config:{...config,entries:[{...entry,roles:['admin','ops','support']}]}});await assert.rejects(saveNavigationSettings(write),/INVALID_ACK/);}finally{globalThis.fetch=original;}
});
test('explicit conflicts and rejections differ from server errors and malformed success',async()=>{
 const original=globalThis.fetch;
 try{for(const code of ['NAVIGATION_CONFLICT','INVALID_INPUT','FORBIDDEN']){globalThis.fetch=async()=>Response.json({error:code},{status:409});await assert.rejects(saveNavigationSettings(write),e=>e instanceof NavigationWriteRejected&&e.message===code);}for(const response of [new Response('broken',{status:200}),new Response('unavailable',{status:503})]){globalThis.fetch=async()=>response;await assert.rejects(saveNavigationSettings(write),e=>e instanceof Error&&!(e instanceof NavigationWriteRejected));}}finally{globalThis.fetch=original;}
});
test('invalid targets and zero-role entries are rejected before any write',async()=>{
 const original=globalThis.fetch;let writes=0;globalThis.fetch=async()=>{writes++;return Response.json({config});};
 try{await assert.rejects(saveNavigationSettings({...write,entries:[{...entry,roles:[]}]}),NavigationWriteRejected);await assert.rejects(saveNavigationSettings({...write,entries:[{...entry,label:''}]}),NavigationWriteRejected);assert.equal(writes,0);}finally{globalThis.fetch=original;}
});
test('unavailable or malformed category data cannot yield a partially refreshed config',async()=>{
 const original=globalThis.fetch;
 try{for(const body of [null,[{...category,version:0}]]){globalThis.fetch=async(url)=>Response.json(String(url).endsWith('/categories')?body:{config});await assert.rejects(readNavigationSettings());}globalThis.fetch=async(url)=>String(url).endsWith('/categories')?new Response('unavailable',{status:503}):Response.json({config});await assert.rejects(readNavigationSettings());}finally{globalThis.fetch=original;}
});
test('empty persisted settings acknowledge as empty without restoring default entries',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({config:{version:6,entries:[]}});
 try{assert.deepEqual(await saveNavigationSettings({expectedVersion:5,entries:[]}),{version:6,entries:[]});}finally{globalThis.fetch=original;}
});
