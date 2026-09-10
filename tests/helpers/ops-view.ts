import {createRequire} from 'node:module';import {mkdir,readFile,writeFile} from 'node:fs/promises';import {resolve,dirname} from 'node:path';import ts from 'typescript';
const require=createRequire(import.meta.url);
export async function loadOpsViews(){
 const directory=resolve('output/verification/ops-fixture');await mkdir(directory,{recursive:true});await writeFile(resolve(directory,'package.json'),'{"type":"commonjs"}');
 const files=['components/ops/OpsCollection.tsx','components/ops/OpsEntryLink.tsx','components/gitbook/Search/SearchResultItem.tsx'];
 for(const file of files){let text:string;try{text=await readFile(`src/${file}`,'utf8');}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}const destination=resolve(directory,file.replace(/\.tsx$/,'.js'));await mkdir(dirname(destination),{recursive:true});await writeFile(destination,ts.transpileModule(text,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);}
 return {OpsCollection:require(resolve(directory,'components/ops/OpsCollection.js')).OpsCollection as typeof import('../../src/components/ops/OpsCollection').OpsCollection,OpsEntryLink:require(resolve(directory,'components/ops/OpsEntryLink.js')).OpsEntryLink as typeof import('../../src/components/ops/OpsEntryLink').OpsEntryLink};
}
