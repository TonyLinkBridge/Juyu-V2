import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadComponent} from './helpers/render-component.ts';
test('publication links open only the explicit immediate confirmation and never publish during navigation',async()=>{
 let reads=0;
 const {default:Page}=loadComponent('src/app/admin/review/publish/page.tsx',{
  '../../../../server/authentication/admin-entry':{currentAdminAccess:async()=>({status:'admin'})},
  '../../../../server/authentication/admin':{adminDestination:()=>'/sign-in'},
  '../../../../server/authorization/application':{applicationAuthorization:async()=>({publicationDetail:async()=>{reads++;return {article:{kind:'qa'}};}})},
  '../../../../components/entry-shell':{EntryShell:({children}:{children:React.ReactNode})=>createElement('div',null,children)},
  '../../../../components/review/PublicationPanel':{PublicationPanel:({initialAction}:{initialAction?:string})=>createElement('span',{'data-intent':initialAction??'none'})},
 });
 for(const [intent,wanted] of [['publish_now','publish_now'],[undefined,'none'],['unexpected','none'],[['publish_now'],'none']] as const){
  const element=await (Page as (input:{searchParams:Promise<unknown>})=>Promise<React.ReactElement>)({searchParams:Promise.resolve({article:'test-only',intent})});
  assert.ok(renderToStaticMarkup(element).includes(`data-intent="${wanted}"`));
 }
 assert.equal(reads,4);
});
