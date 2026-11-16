import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadComponent} from './helpers/render-component.ts';

for(const kind of ['article','ops','reference','qa'] as const){
 test(`${kind} review header returns to its content management section`,async()=>{
  const {default:Page}=loadComponent('src/app/admin/review/page.tsx',{
   '../../../server/authentication/admin-entry':{currentAdminAccess:async()=>({status:'admin'})},
   '../../../server/authentication/admin':{adminDestination:()=>'/sign-in'},
   '../../../server/authorization/application':{applicationAuthorization:async()=>({reviewDetail:async()=>({article:{kind}})})},
   '../../../components/entry-shell':{EntryShell:({children}:{children:React.ReactNode})=>createElement('div',null,children)},
   '../../../components/review/ReviewDecision':{ReviewDecision:()=>null},
  });
  const element=await (Page as (p:{searchParams:Promise<{article:string}>})=>Promise<React.ReactElement>)({searchParams:Promise.resolve({article:'test-only'})});
  const html=renderToStaticMarkup(element);
  const href=kind==='article'?'/admin':`/admin?kind=${kind}&amp;view=list`;
  assert.ok(html.includes(`href="${href}" class="back-link"`),html);
 });
}
