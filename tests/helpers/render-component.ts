import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import {createElement} from 'react';
import ts from 'typescript';
const require=createRequire(import.meta.url);
export function loadComponent(file:string,overrides:Record<string,unknown>={}):Record<string,unknown>{
 const cache=new Map<string,Record<string,unknown>>();
 function load(path:string):Record<string,unknown>{
  const found=cache.get(path);if(found)return found;
  const exports:Record<string,unknown>={};cache.set(path,exports);
  const stub=(name:string):unknown=>{
   if(name in overrides)return overrides[name];
   if(name==='next/link'||name.endsWith('/NavigationLink'))return {__esModule:true,default:(input:Record<string,unknown>)=>{const props={...input};delete props.prefetch;delete props.prefetchOnIntent;return createElement('a',props);},NavigationLink:(input:Record<string,unknown>)=>{const props={...input};delete props.prefetch;delete props.prefetchOnIntent;return createElement('a',props);}};
   if(name==='next/form')return {__esModule:true,default:(props:Record<string,unknown>)=>createElement('form',props)};
   if(!name.startsWith('.'))return require(name);
   const base=resolve(dirname(path),name);const target=[base,base+'.tsx',base+'.ts'].find(p=>existsSync(p));if(!target)throw Error(name);return load(target);
  };
  new Function('require','exports',ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(stub,exports);return exports;
 }
 return load(resolve(file));
}
