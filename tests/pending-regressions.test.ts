import test from 'node:test';import assert from 'node:assert/strict';
import {createElement,type ComponentType} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {loadComponent} from './helpers/render-component.ts';
import {workspaceQuery,publicationLabel} from '../src/workspace/model.ts';
const html=(component:unknown,props:Record<string,unknown>)=>renderToStaticMarkup(createElement(component as ComponentType<Record<string,unknown>>,props));
test('QA clear filters retains module and uses question vocabulary',()=>{
 const {TasksFilters}=loadComponent('src/components/tasks/TasksFilters.tsx');const text=html(TasksFilters,{query:workspaceQuery({kind:'qa',q:'邮箱',status:'draft'})});
 const href=text.match(/href="([^"]+)"/)!;assert.match(href[1],/kind=qa/);assert.match(text,/输入问题/);
});
test('failed workspace retains QA title and retry filter context',()=>{
 const {TasksWorkspace}=loadComponent('src/components/tasks/TasksWorkspace.tsx');const text=html(TasksWorkspace,{query:workspaceQuery({kind:'qa',q:'邮箱',status:'draft'}),retryHref:'/admin?kind=qa&q=邮箱&status=draft',error:'失败'});
 assert.match(text,/Q&amp;A 管理/);assert.match(text,/href="\/admin\?kind=qa&amp;q=邮箱&amp;status=draft"/);
});
test('formal publication labels never display physical revision as publication count',()=>{
 assert.equal(publicationLabel({revision:22,publishedRevision:19,publicationNumber:1,status:'draft'}),'旧正式版 1 仍可阅读');
 assert.equal(publicationLabel({revision:22,publishedRevision:19,status:'published'}),'已发布');
});
test('QA search disabled hides its form and permission failures have actionable text',()=>{
 const {QaView}=loadComponent('src/components/qa/QaView.tsx',{'./AuthenticatedQaAnswer':{AuthenticatedQaAnswer:()=>null}});
 const text=html(QaView,{state:'ready',searchEnabled:false,data:{items:[],total:0,page:1,pages:1,categories:[]}});assert.doesNotMatch(text,/<form/);
 const denied=html(QaView,{state:'denied'});assert.match(denied,/权限/);assert.match(denied,/管理员/);
});
test('QA auth loading shows pending state instead of empty question list',()=>{
 const {AuthenticatedQaAnswer}=loadComponent('src/components/qa/AuthenticatedQaAnswer.tsx',{'@clerk/nextjs':{useAuth:()=>({isLoaded:false})},'./QaAnswer':{QaAnswer:()=>null}});
 assert.match(html(AuthenticatedQaAnswer,{viewerId:'u',id:'q',title:'问题'}),/正在确认/);
});

test('home distinguishes article directory from home and uses publication count without duplicate admin entry',()=>{
 const {KnowledgeHome}=loadComponent('src/components/home/KnowledgeHome.tsx',{'@phosphor-icons/react/dist/ssr':new Proxy({},{get:()=>()=>null}),'../gitbook/Search/SearchInput':{SearchInput:()=>null}});
 const text=html(KnowledgeHome,{pages:[],menu:[{id:'home',label:'帮助中心',href:'/help-centre'}],latest:[],recent:[{id:'one',kind:'article',title:'最近资料',revision:22,publicationNumber:1}],search:false,admin:true});
 assert.match(text,/href="\/help-centre\/library"/);assert.match(text,/>知识文章</);assert.match(text,/正式版本 1/);assert.doesNotMatch(text,/正式版 22|正式版本 22|href="\/admin"/);
});

test('QA route ignores stale search URL when disabled while retaining server feature check',async()=>{
 const calls:unknown[][]=[];
 const {default:page}=loadComponent('src/app/help-centre/qa/page.tsx',{
  'next/navigation':{redirect:(url:string)=>{throw Error('REDIRECT:'+url);}},
  '../../../components/fumadocs/FumadocsQaPage':{FumadocsQaPage:'FumadocsQaPage'},
  '../../../config/clerk':{clerkConfiguration:()=> 'configured'},
  '../../../server/authentication/company-clerk':{employeeCompanyAccess:async()=>({status:'verified',userId:'fixture'})},
  '../../../server/enrollment/application':{applicationEnrollment:async()=>({inspect:async()=>({status:'ready'})})},
  '../../../server/members/entry':{bindCurrentMember:async()=>{}},
  '../../../server/reader-presentation':{readReaderPresentation:async()=>({items:[],features:{search:false}})},
  '../../../server/authorization/application':{applicationAuthorization:async()=>({features:async()=>({search:false}),qa:async(...args:unknown[])=>{calls.push(args);return {items:[],total:0,page:1,pages:1};}})},
 });
 const result=await (page as (props:unknown)=>Promise<unknown>)({searchParams:Promise.resolve({q:'旧搜索',category:'账户'})});
 assert.deepEqual(calls,[[1,'账户',undefined,'zh-CN',undefined]]);assert.match(JSON.stringify(result),/"searchEnabled":false/);
});

test('favorites route keeps the disabled feature distinct and never reads a disabled list',async()=>{
 let reads=0;
 const {default:page}=loadComponent('src/app/help-centre/favorites/page.tsx',{
  'next/navigation':{redirect:(url:string)=>{throw Error('REDIRECT:'+url);}},
  '../../../components/fumadocs/FumadocsFavoritesPage':{FumadocsFavoritesPage:'FumadocsFavoritesPage'},
  '../../../config/clerk':{clerkConfiguration:()=> 'configured'},
  '../../../server/authentication/company-clerk':{employeeCompanyAccess:async()=>({status:'verified',userId:'fixture'})},
  '../../../server/enrollment/application':{applicationEnrollment:async()=>({inspect:async()=>({status:'ready'})})},
  '../../../server/members/entry':{bindCurrentMember:async()=>{}},
  '../../../server/reader-presentation':{readReaderPresentation:async()=>({items:[],features:{search:true}})},
  '../../../server/authorization/application':{applicationAuthorization:async()=>({features:async()=>({favorites:false}),favorites:async()=>{reads++;return {items:[],total:0,page:1,pages:1};}})},
 });
 const result=await (page as (props:unknown)=>Promise<unknown>)({searchParams:Promise.resolve({page:'1'})});
 assert.equal(reads,0);assert.match(JSON.stringify(result),/"state":"disabled"/);assert.match(JSON.stringify(result),/"search":true/);
});

test('recent route keeps the disabled feature distinct and never reads disabled history',async()=>{
 let reads=0;
 const {default:page}=loadComponent('src/app/help-centre/recent/page.tsx',{
  'next/navigation':{redirect:(url:string)=>{throw Error('REDIRECT:'+url);}},
  '../../../components/fumadocs/FumadocsRecentPage':{FumadocsRecentPage:'FumadocsRecentPage'},
  '../../../config/clerk':{clerkConfiguration:()=> 'configured'},
  '../../../server/authentication/company-clerk':{employeeCompanyAccess:async()=>({status:'verified',userId:'fixture'})},
  '../../../server/enrollment/application':{applicationEnrollment:async()=>({inspect:async()=>({status:'ready'})})},
  '../../../server/members/entry':{bindCurrentMember:async()=>{}},
  '../../../server/reader-presentation':{readReaderPresentation:async()=>({items:[],features:{search:true}})},
  '../../../server/authorization/application':{applicationAuthorization:async()=>({features:async()=>({recent:false}),recent:async()=>{reads++;return {items:[],total:0,page:1,pages:1};}})},
 });
 const result=await (page as (props:unknown)=>Promise<unknown>)({searchParams:Promise.resolve({page:'1'})});
 assert.equal(reads,0);assert.match(JSON.stringify(result),/"state":"disabled"/);assert.match(JSON.stringify(result),/"search":true/);
});

test('forms route keeps the disabled feature distinct and never reads disabled forms',async()=>{
 let reads=0;
 const {default:page}=loadComponent('src/app/help-centre/forms/page.tsx',{
  '../../../server/forms/entry':{requireFormReaderEntry:async()=>{}},
  '../../../components/fumadocs/FumadocsFormsPage':{FumadocsFormsPage:'FumadocsFormsPage'},
  '../../../server/reader-presentation':{readReaderPresentation:async()=>({items:[],features:{search:true}})},
  '../../../server/authorization/application':{applicationAuthorization:async()=>({features:async()=>({forms:false}),forms:async()=>{reads++;return [];}})},
 });
 const result=await (page as ()=>Promise<unknown>)();
 assert.equal(reads,0);assert.match(JSON.stringify(result),/"state":"disabled"/);assert.match(JSON.stringify(result),/"search":true/);
});

test('form fill route keeps the disabled feature distinct and never reads a disabled form',async()=>{
 let reads=0;
 const {default:page}=loadComponent('src/app/help-centre/forms/[id]/page.tsx',{
  '../../../../server/forms/entry':{requireFormReaderEntry:async()=>{}},
  '../../../../components/fumadocs/FumadocsFormFillPage':{FumadocsFormFillPage:'FumadocsFormFillPage'},
  '../../../../server/reader-presentation':{readReaderPresentation:async()=>({items:[],features:{search:true}})},
  '../../../../server/authorization/application':{applicationAuthorization:async()=>({features:async()=>({forms:false}),form:async()=>{reads++;throw Error('SHOULD_NOT_READ');}})},
 });
 const result=await (page as (props:unknown)=>Promise<unknown>)({params:Promise.resolve({id:'00000000-0000-4000-8000-000000000010'})});
 assert.equal(reads,0);assert.match(JSON.stringify(result),/"state":"disabled"/);assert.match(JSON.stringify(result),/"search":true/);
});

test('changelog rejects an invalid page before reading updates and keeps the Fumadocs shell',async()=>{
 let reads=0;
 const {default:page}=loadComponent('src/app/help-centre/changelog/page.tsx',{
  'next/navigation':{redirect:(url:string)=>{throw Error('REDIRECT:'+url);}},
  '../../../components/fumadocs/FumadocsChangelogPage':{FumadocsChangelogPage:'FumadocsChangelogPage'},
  '../../../config/clerk':{clerkConfiguration:()=> 'configured'},
  '../../../server/authentication/company-clerk':{employeeCompanyAccess:async()=>({status:'verified',userId:'fixture'})},
  '../../../server/enrollment/application':{applicationEnrollment:async()=>({inspect:async()=>({status:'ready'})})},
  '../../../server/members/entry':{bindCurrentMember:async()=>{}},
  '../../../server/reader-presentation':{readReaderPresentation:async()=>({items:[],features:{search:true}})},
  '../../../server/authorization/application':{applicationAuthorization:async()=>({changelog:async()=>{reads++;throw Error('SHOULD_NOT_READ');}})},
 });
 const result=await (page as (props:unknown)=>Promise<unknown>)({searchParams:Promise.resolve({page:'0',lang:'en'})});
 assert.equal(reads,0);assert.match(JSON.stringify(result),/"state":"unavailable"/);assert.match(JSON.stringify(result),/"locale":"en"/);assert.match(JSON.stringify(result),/"search":true/);
});

test('PDF route keeps a disabled export distinct and does not read protected content',async()=>{
 let reads=0;
 const {default:page}=loadComponent('src/app/help-centre/pdf/page.tsx',{
  'next/navigation':{redirect:(url:string)=>{throw Error('REDIRECT:'+url);}},
  '../../../components/fumadocs/FumadocsPDFPage':{FumadocsPDFPage:'FumadocsPDFPage'},
  '../../../server/reader-presentation':{readReaderPresentation:async()=>({items:[],features:{search:true}})},
  '../../../server/authorization/application':{applicationAuthorization:async()=>({features:async()=>({pdfExport:false}),pdf:async()=>{reads++;throw Error('SHOULD_NOT_READ');}})},
 });
 const result=await (page as (props:unknown)=>Promise<unknown>)({searchParams:Promise.resolve({article:'one',revision:'1'})});
 assert.equal(reads,0);assert.match(JSON.stringify(result),/"state":"disabled"/);assert.match(JSON.stringify(result),/"search":true/);
});
