import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);

/** Compile the production component and CSS Modules with Next's own CSS loader. */
export async function prepareUserMenuFixture(dir:string){
 for(const file of ['user-menu.tsx','motion-tokens.ts','user-menu.module.css','foundation.module.css']){
  const target=resolve(dir,'components/ui/user-menu',file.replace(/\.tsx?$/,'.js'));await mkdir(dirname(target),{recursive:true});
  const content=await readFile(resolve('src/components/ui/user-menu',file),'utf8');
  await writeFile(target,file.endsWith('.css')?content:ts.transpileModule(content,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,rewriteRelativeImportExtensions:true}}).outputText);
 }
 const loader=resolve(dir,'css-module.cjs'),inject=resolve(dir,'inject-css.cjs');
 await writeFile(loader,`const original=require(${JSON.stringify(require.resolve('next/dist/build/webpack/loaders/css-loader/src'))}).default;module.exports=function(content,map,meta){const context=Object.create(this);const options=this.getOptions();Object.defineProperties(context,{currentTraceSpan:{value:{traceChild:()=>({traceAsyncFn:fn=>fn()})}},getOptions:{value:()=>({...options,modules:{...options.modules,getLocalIdent:require(${JSON.stringify(require.resolve('next/dist/build/webpack/config/blocks/css/loaders/getCssModuleLocalIdent'))}).getCssModuleLocalIdent},postcss:async()=>({postcss:require(${JSON.stringify(require.resolve('postcss'))})})})}});return original.call(context,content,map,meta);};`);
 await writeFile(inject,`module.exports=function(source){return source+String.fromCharCode(10)+'if(typeof document!=="undefined"){const style=document.createElement("style");style.textContent=module.exports.toString();document.head.append(style);}module.exports=module.exports.locals;';};`);
 return {test:/\.module\.css$/,use:[inject,{loader,options:{esModule:false,modules:{mode:'local'},url:false}}]};
}
