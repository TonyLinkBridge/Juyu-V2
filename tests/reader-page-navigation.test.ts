import assert from 'node:assert/strict';
import {test} from 'node:test';
import {pageNavigation} from '../src/reader/page-navigation.ts';
import type {NavigationNode} from '../src/reader/tree.ts';
const page=(id:string,title=id):NavigationNode=>({type:'document',id,title,href:`/help-centre/articles/${encodeURIComponent(id)}`});
const nodes:NavigationNode[]=[{type:'group',id:'g1',title:'内容排期',descendants:[page('prepare'),{type:'group',id:'g2',title:'审核流程',descendants:[page('review','提交审核'),page('publish')]}]},page('reference')];
test('breadcrumbs and neighbours follow authorized depth-first directory order across groups',()=>{
 const result=pageNavigation(nodes,'review');assert.deepEqual(result?.ancestors,[{id:'g1',title:'内容排期'},{id:'g2',title:'审核流程'}]);
 assert.equal(result?.previous?.id,'prepare');assert.equal(result?.next?.id,'publish');assert.equal(result?.current.title,'提交审核');
 assert.equal(pageNavigation(nodes,'publish')?.next?.id,'reference');assert.deepEqual(pageNavigation(nodes,'reference')?.ancestors,[]);
});
test('endpoints, singleton and invalid selections have no fabricated or wraparound links',()=>{
 assert.equal(pageNavigation(nodes,'prepare')?.previous,null);assert.equal(pageNavigation(nodes,'reference')?.next,null);
 const single=pageNavigation([page('one')],'one');assert.equal(single?.previous,null);assert.equal(single?.next,null);
 for(const selected of [undefined,'secret',['review','publish']])assert.equal(pageNavigation(nodes,selected),null);
 assert.equal(pageNavigation([],'review'),null);
});
test('duplicate memberships produce one logical step and never turn a page into its own neighbour',()=>{
 const result=pageNavigation([...nodes,page('review')],'review');assert.equal(result?.previous?.id,'prepare');assert.equal(result?.next?.id,'publish');
 assert.equal(pageNavigation([...nodes,page('review')],'reference')?.next,null);
 const special=pageNavigation([page('a&role=admin/#中文')],'a&role=admin/#中文');assert.equal(special?.current.href,'/help-centre/articles/a%26role%3Dadmin%2F%23%E4%B8%AD%E6%96%87');
});
test('breadcrumb shortcuts contain only readable sibling groups and their first readable pages',()=>{
 const menuNodes:NavigationNode[]=[{type:'group',id:'account',title:'账户管理',descendants:[
  {type:'group',id:'security',title:'账户安全',descendants:[page('email','修改邮箱')]},
  {type:'group',id:'billing',title:'账单',descendants:[page('invoice','查看账单')]}
 ]},{type:'group',id:'ops',title:'运营流程',descendants:[page('handoff','交接')]}];
 const crumbs=pageNavigation(menuNodes,'email')?.ancestors;
 assert.deepEqual(crumbs?.[0].siblings?.map(item=>[item.title,item.href]),[['账户管理','/help-centre/articles/email'],['运营流程','/help-centre/articles/handoff']]);
 assert.deepEqual(crumbs?.[1].siblings?.map(item=>[item.title,item.href]),[['账户安全','/help-centre/articles/email'],['账单','/help-centre/articles/invoice']]);
 assert.equal(JSON.stringify(crumbs).includes('private'),false);
});
test('previous and next links preserve the authorized English directory URL',()=>{
 const english:NavigationNode[]=[{type:'document',id:'first',title:'first',href:'/help-centre/articles/first'},{type:'document',id:'second',title:'second',href:'/help-centre/articles/second'}];
 assert.equal(pageNavigation(english,'first')?.next?.href,'/help-centre/articles/second');
});
