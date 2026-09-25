import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement,type ReactNode} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadComponent} from './helpers/render-component.ts';

type Inspect=()=>Promise<unknown>;

async function renderAccess(inspect:Inspect){
 let attempts=0;
 const {default:HelpCentre}=loadComponent('src/app/help-centre/page.tsx',{
  '../../features/model':{closedFeatureFlags:{}},
  '../../config/reader-presentation':{readerAnnouncement:null},
  '../../reader/search':{parseSearchQuery:()=>({query:''}),parseSearchScope:()=> 'all',searchTitles:()=>({}),searchHref:()=>'/help-centre'},
  '../../components/fumadocs/FumadocsDirectoryState':{FumadocsDirectoryState:'FumadocsDirectoryState'},
  '../../components/fumadocs/FumadocsKnowledgeHome':{FumadocsHomeShell:({children}:{children:ReactNode})=>createElement('div',null,children),FumadocsKnowledgeHome:()=>createElement('div',{'data-component':'FumadocsKnowledgeHome'})},
  '../../components/fumadocs/FumadocsSearchPage':{FumadocsSearchPage:'FumadocsSearchPage'},
  '../../server/authorization/application':{applicationAuthorization:async()=>({home:async()=>({pages:[],menu:[],features:{search:true,recent:true},latest:[],recent:[]})})},
  '../../server/enrollment/application':{applicationEnrollment:async()=>({inspect:async()=>{attempts++;return inspect();}})},
  '../../components/enrollment-panel':{EnrollmentPanel:'EnrollmentPanel'},
  '../../server/members/entry':{bindCurrentMember:async()=>{}},
  'next/navigation':{redirect:(url:string)=>{throw Error('REDIRECT:'+url);}},
  '../../server/authentication/admin-clerk':{adminForCompany:async()=>({status:'admin'})},
  '../../config/clerk':{clerkConfiguration:()=> 'configured'},
  '../../server/authentication/company-clerk':{employeeCompanyAccess:async()=>({status:'verified',userId:'tony'})},
  '../../components/entry-shell':{ShieldIcon:()=>null},
  '../../components/employee-sign-out':{EmployeeSignOut:()=>null},
  '../../reader/tree':{firstTreePage:()=>undefined},
  '../../fumadocs/publication':{formalFumadocsPublicationPath:(id:string)=>`/help-centre/articles/${id}`},
 });
 const element=await (HelpCentre as (props:{searchParams:Promise<Record<string,string>>})=>Promise<unknown>)({searchParams:Promise.resolve({})});
 return {attempts,html:renderToStaticMarkup(element as ReturnType<typeof createElement>)};
}

test('a transient enrollment read retries once and recovers the Help Centre',async()=>{
 let reads=0;
 const result=await renderAccess(async()=>{if(reads++===0)throw Error('SERVICE_UNAVAILABLE');return {status:'ready',role:'admin',initialAdmin:false};});
 assert.equal(result.attempts,2);
 assert.match(result.html,/FumadocsKnowledgeHome/);
 assert.doesNotMatch(result.html,/资料库访问尚未开通/);
});

test('repeated enrollment read failure is honest and retryable instead of claiming access is unopened',async()=>{
 const result=await renderAccess(async()=>{throw Error('SERVICE_UNAVAILABLE');});
 assert.equal(result.attempts,2);
 assert.match(result.html,/资料库暂时无法读取/);
 assert.match(result.html,/重新读取资料库/);
 assert.doesNotMatch(result.html,/资料库访问尚未开通|资料库仍在准备中/);
});

test('a definite member denial is not retried or weakened',async()=>{
 const result=await renderAccess(async()=>{throw Error('FORBIDDEN: member disabled');});
 assert.equal(result.attempts,1);
 assert.match(result.html,/资料库访问已暂停/);
 assert.doesNotMatch(result.html,/重新读取资料库/);
});
