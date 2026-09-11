import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
export async function readerFrameBundle(){
 const dir=resolve('output/verification/reader-frame');await mkdir(dir,{recursive:true});
 const files=['components/shell/NavigationLink.tsx','components/shell/ReaderFrame.tsx','components/shell/AdminFrame.tsx','components/shell/AccountControls.tsx','components/reader-chrome.tsx','components/employee-sign-out.tsx','authentication/sign-out.ts','authentication/login-flow.ts','components/gitbook/ThemeToggler/ThemeToggler.tsx','reader/theme.ts'];
 for(const file of files){const target=resolve(dir,file.replace(/\.tsx?$/,'.js'));await mkdir(dirname(target),{recursive:true});await writeFile(target,ts.transpileModule(await readFile('src/'+file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,rewriteRelativeImportExtensions:true}}).outputText);}
 await writeFile(resolve(dir,'navigation.js'),`export function usePathname(){return new URLSearchParams(window.location.search).get('screen')==='pdf'?'/help-centre/pdf':'/help-centre';}export function useSearchParams(){return new URLSearchParams(window.location.search);}`);
 await writeFile(resolve(dir,'link.js'),`import React from 'react';export function useLinkStatus(){return {pending:false};}export default function Link({prefetch,...props}){return React.createElement('a',props);}`);
 await writeFile(resolve(dir,'clerk.js'),`export const ClerkFailed=()=>null;export const ClerkLoading=()=>null;export const useUser=()=>({});export const useClerk=()=>({});export const useSession=()=>({});`);
 await writeFile(resolve(dir,'entry.js'),`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {ReaderFrame} from './components/shell/ReaderFrame';import {ShellSlot} from './components/shell/AdminFrame';
 const h=React.createElement;
 function App(){const [view,setView]=useState('首页'),[notice,setNotice]=useState(true);return h(ReaderFrame,{accountEnabled:false,navigation:h('nav',{'aria-label':'测试导航'},h('button',{onClick:()=>setView('OPS Internal')},'OPS Internal')),search:h('input',{'aria-label':'测试搜索'})},notice&&h('section',{className:'feature-announcements'},'真实公告',h('button',{onClick:()=>setNotice(false)},'关闭公告')),h(ShellSlot,{chrome:h('header',null,'重复标题栏'),footer:null,navigation:h('nav',null,'重复目录')},h('main',{id:'main-content'},h('h1',null,view))));}createRoot(document.getElementById('app')).render(h(App));`);
 const {webpack}=require('next/dist/compiled/webpack/webpack');
 await new Promise<void>((done,reject)=>{const compiler=webpack({mode:'development',devtool:false,entry:resolve(dir,'entry.js'),output:{path:dir,filename:'bundle.js'},resolve:{modules:[resolve('node_modules')],alias:{'next/navigation':resolve(dir,'navigation.js'),'next/link':resolve(dir,'link.js'),'@clerk/nextjs':resolve(dir,'clerk.js')}},module:{rules:[{test:/\.js$/,resolve:{fullySpecified:false}}]}});compiler.run((error:Error|null,stats:{hasErrors():boolean;toString():string})=>compiler.close(()=>error||stats.hasErrors()?reject(error??new Error(stats.toString())):done()));});
 const css=(await readdir('.next/static/chunks')).filter(f=>f.endsWith('.css'));
 return {script:await readFile(resolve(dir,'bundle.js'),'utf8'),css:(await Promise.all(css.map(f=>readFile(resolve('.next/static/chunks',f),'utf8')))).join('\n')};
}
