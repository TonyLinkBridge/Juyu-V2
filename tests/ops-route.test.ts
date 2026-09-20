import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';import ts from 'typescript';import {opsQuery} from '../src/server/ops/http.ts';
const require=createRequire(import.meta.url);
async function route(error='',empty=false){
 const source=await readFile('src/app/help-centre/ops/page.tsx','utf8');const exports:Record<string,unknown>={};
 const stub=(name:string)=>{
 if(name==='react/jsx-runtime')return require(name);
 if(name==='next/navigation')return {redirect:(href:string)=>{throw new Error('REDIRECT:'+href);}};
 if(name.endsWith('/performance'))return {measured:(_name:string,fn:()=>unknown)=>fn()};
 if(name.endsWith('/config/clerk'))return {clerkConfiguration:()=> 'configured'};
 if(name.endsWith('/company-clerk'))return {employeeCompanyAccess:async()=>({status:'verified'})};
 if(name.endsWith('/enrollment/application'))return {applicationEnrollment:async()=>({inspect:async()=>({status:'ready'})})};
 if(name.endsWith('/members/entry'))return {bindCurrentMember:async()=>{}};
 if(name.endsWith('/ops/http'))return {opsQuery};
 if(name.endsWith('/authorization/application'))return {applicationAuthorization:async()=>({firstOpsId:async()=>{if(error)throw new Error(error);return empty?null:"ops & one";},ops:async()=>{if(error)throw new Error(error);return {items:empty?[]:[{id:'ops & one'}],total:empty?0:1,page:1,pages:1};}})};
 return new Proxy({},{get:(_,key)=>String(key)});
 };
 new Function('require','exports',ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText)(stub,exports);
 return exports.default as (p:{searchParams:Promise<Record<string,string|string[]>>})=>Promise<unknown>;
}
test('OPS entry opens authorized article directly and preserves redirect',async()=>{const page=await route();await assert.rejects(()=>page({searchParams:Promise.resolve({})}),/REDIRECT:\/help-centre\?article=ops%20%26%20one/);});
test('OPS denied, unavailable and empty states stay separate without a content redirect',async()=>{for(const error of ['FORBIDDEN','SERVICE_UNAVAILABLE','']){const page=await route(error,true);const output=JSON.stringify(await page({searchParams:Promise.resolve({})}));assert.ok(output.includes('"state":"'+(error==='FORBIDDEN'?'denied':error?'unavailable':'ready')+'"'));assert.ok(!output.includes('ops & one'));}});
