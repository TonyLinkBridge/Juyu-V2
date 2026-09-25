import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';import ts from 'typescript';import {referenceQuery} from '../src/server/reference/http.ts';
const require=createRequire(import.meta.url);
async function route(error='',empty=false){
 const source=await readFile('src/app/help-centre/reference/page.tsx','utf8');const exports:Record<string,unknown>={};
 const stub=(name:string)=>{
 if(name==='react/jsx-runtime')return require(name);
 if(name==='next/navigation')return {redirect:(href:string)=>{throw new Error('REDIRECT:'+href);}};
 if(name.endsWith('/performance'))return {measured:(_name:string,fn:()=>unknown)=>fn()};
 if(name.endsWith('/config/clerk'))return {clerkConfiguration:()=> 'configured'};
 if(name.endsWith('/company-clerk'))return {employeeCompanyAccess:async()=>({status:'verified'})};
 if(name.endsWith('/enrollment/application'))return {applicationEnrollment:async()=>({inspect:async()=>({status:'ready'})})};
 if(name.endsWith('/members/entry'))return {bindCurrentMember:async()=>{}};
 if(name.endsWith('/reader-presentation'))return {readReaderPresentation:async()=>({items:[],features:{search:true}})};
 if(name.endsWith('/reference/http'))return {referenceQuery};
 if(name.endsWith('/authorization/application'))return {applicationAuthorization:async()=>({referencePage:async(_page:number,requested?:string)=>{if(['FORBIDDEN','SERVICE_UNAVAILABLE'].includes(error))throw new Error(error);const data={items:empty?[]:[{id:'00000000-0000-4000-8000-000000000001'}],total:empty?0:1,page:1,pages:1};const id=requested??data.items[0]?.id;return {data,detail:id&&!error?{id,title:'费用',revision:1,tables:[]}:undefined,detailState:id?(error?'unavailable':'ready'):'idle'};}})};
 return new Proxy({},{get:(_,key)=>String(key)});
 };
 new Function('require','exports',ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText)(stub,exports);
 return exports.default as (p:{searchParams:Promise<Record<string,string|string[]>>})=>Promise<unknown>;
}
test('R07 default entry selects the first authorized reference',async()=>{const page=await route();const result=JSON.stringify(await page({searchParams:Promise.resolve({})}));assert.ok(result.includes('"detailState":"ready"'));assert.ok(result.includes('00000000-0000-4000-8000-000000000001'));});
test('R07 empty list does not request a detail',async()=>{const page=await route('MUST_NOT_READ',true);const result=JSON.stringify(await page({searchParams:Promise.resolve({})}));assert.ok(result.includes('"detailState":"idle"'));});
test('R07 explicit selection is honored and unavailable detail never falls back to another item',async()=>{const id='00000000-0000-4000-8000-000000000002';const page=await route();const result=JSON.stringify(await page({searchParams:Promise.resolve({article:id})}));assert.ok(result.includes('"detail":{"id":"'+id+'"'));const failed=await route('NOT_FOUND');assert.ok(JSON.stringify(await failed({searchParams:Promise.resolve({article:id})})).includes('"detailState":"unavailable"'));});

test('reference permission and service errors preserve distinct states and suppress detail',async()=>{for(const [error,state] of [['FORBIDDEN','denied'],['SERVICE_UNAVAILABLE','unavailable']]){const page=await route(error);const result=JSON.stringify(await page({searchParams:Promise.resolve({})}));assert.ok(result.includes('"state":"'+state+'"'));assert.ok(!result.includes('费用'));}});
