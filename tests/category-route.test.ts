import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {createRequire} from 'node:module';
import {categoryPage} from '../src/reader/category-page.ts';
import {formPage} from '../src/server/forms/http.ts';
const require=createRequire(import.meta.url);
const id='00000000-0000-4000-8000-000000000100';
const tree=[{type:'group' as const,id,title:'账户管理',descendants:[{type:'document' as const,id:'article-one',title:'账户安全',href:'/help-centre/articles/article-one'}]}];
async function route({nodes=tree,error='',entryError=false}={}){
 const source=await readFile('src/app/help-centre/categories/[id]/page.tsx','utf8');
 const code=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText;
 const exports:Record<string,unknown>={};
 const stub=(name:string)=>{
  if(name==='react/jsx-runtime')return require(name);
  if(name==='next/navigation')return {redirect:(href:string)=>{throw new Error('REDIRECT:'+href);}};
  if(name.endsWith('/forms/entry'))return {requireFormReaderEntry:async()=>{if(entryError)throw new Error('ENTRY_DENIED');}};
  if(name.endsWith('/authorization/application'))return {applicationAuthorization:async()=>({
   categoryNavigationTree:async()=>{if(error)throw new Error(error);return nodes;},
   readerMenu:async()=>[],
   features:async()=>({search:false}),
  })};
  if(name.endsWith('/fumadocs/FumadocsDirectoryState'))return {FumadocsDirectoryState:(props:unknown)=>({type:'FumadocsDirectoryState',props})};
  if(name.endsWith('/category-page'))return {categoryPage};
  if(name.endsWith('/forms/http'))return {formPage};
  return new Proxy({},{get:(_,key)=>String(key)});
 };
 new Function('require','exports',code)(stub,exports);
 return exports.default as (p:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]>>})=>Promise<unknown>;
}
const params=(category=id,query:Record<string,string|string[]>={})=>({params:Promise.resolve({id:category}),searchParams:Promise.resolve(query)});
test('category route directly opens authorized reading without catching Next redirect',async()=>{
 const page=await route();await assert.rejects(()=>page(params()),/REDIRECT:\/help-centre\/articles\/article-one/);
});
test('missing or inaccessible category keeps unavailable state without disclosing title',async()=>{
 const page=await route({nodes:[]});const result=await page(params());const output=JSON.stringify(result);assert.ok(!output.includes('账户管理'));assert.ok(output.includes('"failed":false'));assert.ok(output.includes('分类暂不可用'));
});
test('category service failure is distinguished from empty and entry denial is not swallowed',async()=>{
 const page=await route({error:'SERVICE_UNAVAILABLE'});const output=JSON.stringify(await page(params()));assert.ok(output.includes('"failed":true'));assert.ok(output.includes('分类暂时无法加载'));
 const denied=await route({entryError:true});await assert.rejects(()=>denied(params()),/ENTRY_DENIED/);
});
test('invalid category and repeated page input never redirect into broader collection',async()=>{
 const page=await route();for(const args of [params('../private'),params(id,{page:['1','2']})]){const output=JSON.stringify(await page(args));assert.ok(output.includes('"failed":false'));assert.ok(output.includes('分类暂不可用'));}
});
