import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadComponent} from './helpers/render-component.ts';
test('own-submission shortcut opens only the current owner confirmation and never writes during page rendering',async()=>{
 let reads=0;let snapshot={submittedBy:'author',canManageReview:true,status:'in_review',lifecycle:'active'};
 const {default:Page}=loadComponent('src/app/admin/review/manage/page.tsx',{
  '../../../../server/authentication/admin-entry':{currentAdminAccess:async()=>({status:'admin',userId:'author'})},
  '../../../../server/authentication/admin':{adminDestination:()=>'/sign-in'},
  '../../../../server/authorization/application':{applicationAuthorization:async()=>({controlReviewDetail:async()=>{reads++;return snapshot;}})},
  '../../../../components/entry-shell':{EntryShell:({children}:{children:React.ReactNode})=>createElement('div',null,children)},
  '../../../../components/review/ReviewControl':{ReviewControl:({initialAction}:{initialAction?:string})=>createElement('span',{'data-intent':initialAction??'none'})},
 });
 async function render(intent:unknown){return renderToStaticMarkup(await (Page as (props:{searchParams:Promise<unknown>})=>Promise<React.ReactElement>)({searchParams:Promise.resolve({article:'test-own',intent})}));}
 assert.match(await render('withdraw'),/data-intent="withdraw"/);
 for(const intent of [undefined,'approve',['withdraw'],'unexpected'])assert.match(await render(intent),/data-intent="none"/);
 for(const patch of [{submittedBy:'another'},{canManageReview:false},{status:'draft'},{lifecycle:'archived'}]){const before=snapshot;snapshot={...snapshot,...patch};assert.match(await render('withdraw'),/data-intent="none"/);snapshot=before;}
 assert.equal(reads,9);
});
