import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import type { MemberList } from '../../src/server/members/service';
const require=createRequire(import.meta.url);
export const memberFixture:MemberList={actorId:'admin-a',actorRole:'admin',nextCursor:null,operations:[],members:[
 {clerk_user_id:'admin-a',display_name:'测试管理员',verified_email:'admin@company.test',disabled_at:null,observed_role:'admin',pending:false,role:'admin',providerStatus:'active'},
 {clerk_user_id:'staff-a',display_name:'测试客服',verified_email:'support@company.test',disabled_at:null,observed_role:'support',pending:false,role:'support',providerStatus:'active'},
 {clerk_user_id:'ops-a',display_name:'测试运营',verified_email:'ops@company.test',disabled_at:null,observed_role:'ops',pending:false,role:'ops',providerStatus:'active'},
]};
export const superMemberFixture:MemberList={...structuredClone(memberFixture),actorId:'super-a',actorRole:'super_admin',members:[
 {clerk_user_id:'super-a',display_name:'超级管理员',verified_email:'super@company.test',disabled_at:null,observed_role:'super_admin',pending:false,role:'super_admin',providerStatus:'active'},
 ...structuredClone(memberFixture.members.slice(1)),
]};
export async function memberBrowserBundle(){
 const directory=resolve('output/verification/member-fixture');await mkdir(directory,{recursive:true});
 const source=await readFile('src/components/members-panel.tsx','utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 await writeFile(resolve(directory,'panel.js'),compiled);
 await writeFile(resolve(directory,'entry.js'),`import React from 'react';import {createRoot} from 'react-dom/client';import {MembersPanel} from './panel.js';let root;window.mountMembers=data=>{root?.unmount();root=createRoot(document.getElementById('panel'));root.render(React.createElement(MembersPanel,{initial:data}));};window.mountMembers(${JSON.stringify(memberFixture)});`);
 const {webpack}=require('next/dist/compiled/webpack/webpack');
 await new Promise<void>((done,reject)=>{
  const compiler=webpack({mode:'development',devtool:false,entry:resolve(directory,'entry.js'),output:{path:directory,filename:'bundle.js'},resolve:{modules:[resolve('node_modules')]}});
  compiler.run((error:Error|null,stats:{hasErrors():boolean;toString():string})=>compiler.close(()=>error||stats.hasErrors()?reject(error??new Error(stats.toString())):done()));
 });
 return {script:await readFile(resolve(directory,'bundle.js'),'utf8'),css:(await readFile('src/app/globals.css','utf8')).replace('@import "tailwindcss";','')};
}
