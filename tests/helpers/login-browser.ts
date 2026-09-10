import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
export async function loginBundle(){
 const dir=resolve('output/verification/login-fixture');await mkdir(dir,{recursive:true});
 const files=['components/login-screen.tsx','components/employee-login.tsx','authentication/login-flow.ts'];
 for(const file of files){const target=resolve(dir,file.replace(/\.tsx?$/,'.js'));await mkdir(dirname(target),{recursive:true});await writeFile(target,ts.transpileModule(await readFile('src/'+file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,rewriteRelativeImportExtensions:true}}).outputText);}
 await writeFile(resolve(dir,'navigation.js'),`export function usePathname(){const p=new URLSearchParams(location.search);return (p.get('audience')==='admin'?'/admin':'')+'/sign-in'+(p.get('step')?'/factor-one':'');}`);
 await writeFile(resolve(dir,'link.js'),`import React from 'react';export default function Link({prefetch,...props}){return React.createElement('a',props);}`);
 await writeFile(resolve(dir,'clerk.js'),`import React from 'react';const h=React.createElement;const state=new URLSearchParams(location.search).get('state')||'loaded';export const ClerkLoaded=({children})=>state==='loaded'?children:null;export const ClerkLoading=({children})=>state==='loading'?children:null;export const ClerkFailed=({children})=>state==='failed'?children:null;
 export function SignIn(props){return h('div',{className:'cl-rootBox','data-path':props.path,'data-redirect':props.forceRedirectUrl,'data-signup-redirect':props.signUpForceRedirectUrl,'data-signup':String(props.withSignUp)},h('div',{className:'cl-header'},'验证你的账号'),h('button',{className:'cl-socialButtonsBlockButton',style:{width:'100%',height:54}},'使用 Slack 登录'),h('div',{className:'cl-dividerRow'},'或'),h('form',{className:'cl-form'},h('label',null,'公司邮箱',h('input',{type:'email'})),h('button',{type:'button'},'继续')),h('div',{className:'cl-footerAction'},'注册'),h('div',{role:'alert'},new URLSearchParams(location.search).has('error')?'登录失败，请重试':''));}`);
 await writeFile(resolve(dir,'entry.js'),`import React from 'react';import {createRoot} from 'react-dom/client';import {LoginScreen} from './components/login-screen';import {EmployeeLogin} from './components/employee-login';const audience=new URLSearchParams(location.search).get('audience')==='admin'?'admin':'employee';createRoot(document.getElementById('app')).render(React.createElement(LoginScreen,{audience},React.createElement(EmployeeLogin,{audience})));`);
 const {webpack}=require('next/dist/compiled/webpack/webpack');
 await new Promise<void>((done,reject)=>{const compiler=webpack({mode:'development',devtool:false,entry:resolve(dir,'entry.js'),output:{path:dir,filename:'bundle.js'},resolve:{modules:[resolve('node_modules')],alias:{'next/navigation':resolve(dir,'navigation.js'),'next/link':resolve(dir,'link.js'),'@clerk/nextjs':resolve(dir,'clerk.js')}},module:{rules:[{test:/\.js$/,resolve:{fullySpecified:false}}]}});compiler.run((error:Error|null,stats:{hasErrors():boolean;toString():string})=>compiler.close(()=>error||stats.hasErrors()?reject(error??new Error(stats.toString())):done()));});
 const css=(await readdir('.next/static/chunks')).filter(f=>f.endsWith('.css'));
 return {script:await readFile(resolve(dir,'bundle.js'),'utf8'),css:(await Promise.all(css.map(f=>readFile(resolve('.next/static/chunks',f),'utf8')))).join('\n')};
}
