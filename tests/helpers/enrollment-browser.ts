import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
export async function enrollmentBrowserBundle(){
 const directory=resolve('output/verification/enrollment-fixture');await mkdir(directory,{recursive:true});
 const source=await readFile('src/components/enrollment-panel.tsx','utf8');
 await writeFile(resolve(directory,'panel.js'),ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
 await writeFile(resolve(directory,'entry.js'),"import React from 'react';import {createRoot} from 'react-dom/client';import {EnrollmentPanel} from './panel.js';createRoot(document.getElementById('panel')).render(React.createElement(EnrollmentPanel,{initial:{status:'required'}}));");
 const {webpack}=require('next/dist/compiled/webpack/webpack');
 await new Promise<void>((done,reject)=>{const compiler=webpack({mode:'development',devtool:false,entry:resolve(directory,'entry.js'),output:{path:directory,filename:'bundle.js'},resolve:{modules:[resolve('node_modules')]}});compiler.run((error:Error|null,stats:{hasErrors():boolean;toString():string})=>compiler.close(()=>error||stats.hasErrors()?reject(error??new Error(stats.toString())):done()));});
 return {script:await readFile(resolve(directory,'bundle.js'),'utf8'),css:(await readFile('src/app/globals.css','utf8')).replace('@import "tailwindcss";','')};
}
