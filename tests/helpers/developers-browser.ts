import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
export async function developersBrowserBundle(){
 const dir=resolve('output/verification/developers-fixture');await mkdir(dir,{recursive:true});
 for(const file of ['components/developers/DeveloperConsole.tsx','developers/model.ts','review/publication-diagnostics.ts','components/shell/AdminFrame.tsx']){
  const target=resolve(dir,file.replace(/\.tsx?$/,'.js'));await mkdir(dirname(target),{recursive:true});
  await writeFile(target,ts.transpileModule(await readFile(`src/${file}`,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,rewriteRelativeImportExtensions:true}}).outputText);
 }
 await writeFile(resolve(dir,'link.js'),`import React from 'react';export default function Link({prefetch,...props}){return React.createElement('a',props);}`);
 await writeFile(resolve(dir,'entry.js'),`import React from 'react';import {createRoot} from 'react-dom/client';import {DeveloperConsole} from './components/developers/DeveloperConsole';import {AdminFrame} from './components/shell/AdminFrame';const params=new URLSearchParams(location.search),section=params.get('section')||'overview';const content=React.createElement(DeveloperConsole,{section});createRoot(document.getElementById('developers')).render(params.get('frame')==='1'?React.createElement(AdminFrame,{developerEnabled:true},content):content);`);
 await writeFile(resolve(dir,'navigation.js'),`export const usePathname=()=>location.pathname.startsWith('/__developers_fixture')?'/admin/developers/'+new URLSearchParams(location.search).get('section'):location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);`);
 await writeFile(resolve(dir,'components/shell/NavigationLink.js'),`import React from 'react';export function NavigationLink({prefetch,prefetchOnIntent,...props}){return React.createElement('a',props);}`);
 await writeFile(resolve(dir,'components/shell/AccountControls.js'),`import React from 'react';export function AccountMenu(){return React.createElement('span',null,'本地测试');}`);
 const {webpack}=require('next/dist/compiled/webpack/webpack');
 await new Promise<void>((done,reject)=>{const compiler=webpack({mode:'development',devtool:false,entry:resolve(dir,'entry.js'),output:{path:dir,filename:'bundle.js'},resolve:{modules:[resolve('node_modules')],alias:{'next/link':resolve(dir,'link.js'),'next/navigation':resolve(dir,'navigation.js')}},module:{rules:[{test:/\.js$/,resolve:{fullySpecified:false}}]}});compiler.run((error:Error|null,stats:{hasErrors():boolean;toString():string})=>compiler.close(()=>error||stats.hasErrors()?reject(error??new Error(stats.toString())):done()));});
 return {script:await readFile(resolve(dir,'bundle.js'),'utf8'),css:(await readFile('src/app/globals.css','utf8')).replace('@import "tailwindcss";','')+await readFile('src/app/product-shell.css','utf8')+await readFile('src/app/admin/admin-data.css','utf8')+await readFile('src/app/admin/developers/developers.css','utf8')};
}
