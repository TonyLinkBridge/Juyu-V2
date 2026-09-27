import assert from 'node:assert/strict';
import test from 'node:test';
import {fumadocsContentTabs} from '../src/fumadocs/tabs.ts';

const menu=[
 {id:'00000000-0000-4000-8000-000000000001',label:'帮助中心',href:'/help-centre'},
 {id:'00000000-0000-4000-8000-000000000002',label:'OPS Internal',href:'/help-centre/ops'},
 {id:'00000000-0000-4000-8000-000000000003',label:'Reference 速查',href:'/help-centre/reference'},
 {id:'00000000-0000-4000-8000-000000000004',label:'Q&A 问答',href:'/help-centre/qa'},
 {id:'00000000-0000-4000-8000-000000000005',label:'我的收藏',href:'/help-centre/favorites'},
];

test('official Fumadocs layout tabs contain only authorized content libraries',()=>{
 const tabs=fumadocsContentTabs(menu,'zh-CN');
 assert.deepEqual(tabs.map(({title,description,url})=>({title,description,url})),[
  {title:'知识文章',description:'团队正式知识',url:'/help-centre/library'},
  {title:'OPS Internal',description:'运营流程与升级处理',url:'/help-centre/ops'},
  {title:'Reference 速查',description:'业务规则速查',url:'/help-centre/reference'},
  {title:'Q&A 问答',description:'已审核标准答案',url:'/help-centre/qa'},
 ]);
 assert.ok(tabs.every(tab=>tab.icon));
});

test('official Fumadocs layout tabs preserve authorization and locale',()=>{
 const tabs=fumadocsContentTabs(menu.filter(item=>item.href!=='/help-centre/ops'),'en');
 assert.deepEqual(tabs.map(({title,description,url})=>({title,description,url})),[
  {title:'Articles',description:'Approved team knowledge',url:'/help-centre/library?lang=en'},
  {title:'Reference',description:'Business rules and quick reference',url:'/help-centre/reference?lang=en'},
  {title:'Q&A',description:'Reviewed standard answers',url:'/help-centre/qa?lang=en'},
 ]);
});

test('the shared design preview can select the official OPS tab without changing formal routes',()=>{
 const tabs=fumadocsContentTabs(menu,'zh-CN',{
  path:'/help-centre/ops',
  pathname:'/design-preview/fumadocs-reader',
 });
 assert.deepEqual([...tabs[1].urls??[]],[
  '/help-centre/ops',
  '/design-preview/fumadocs-reader',
 ]);
 assert.equal(tabs[0].urls,undefined);
});

test('a formal knowledge article keeps the independent Articles library selected',()=>{
 const tabs=fumadocsContentTabs(menu,'zh-CN',{
  path:'/help-centre/library',
  pathname:'/help-centre/articles/member-rights',
 });
 assert.deepEqual([...tabs[0].urls??[]],[
  '/help-centre/library',
  '/help-centre/articles/member-rights',
 ]);
 assert.equal(tabs[0].url,'/help-centre/library');
});

test('the Articles switcher links straight to the first authorized article when known',()=>{
 const tabs=fumadocsContentTabs(
  menu,
  'zh-CN',
  {path:'/help-centre/reference',pathname:'/help-centre/reference'},
  '/help-centre/articles/member-rights',
 );
 assert.equal(tabs[0].url,'/help-centre/articles/member-rights');
 assert.equal(tabs[2].url,'/help-centre/reference');
});
