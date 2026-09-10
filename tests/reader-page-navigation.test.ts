import assert from 'node:assert/strict';
import {test} from 'node:test';
import {pageNavigation} from '../src/reader/page-navigation.ts';
import type {NavigationNode} from '../src/reader/tree.ts';
const page=(id:string,title=id):NavigationNode=>({type:'document',id,title,href:`/help-centre?article=${encodeURIComponent(id)}`});
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
 const special=pageNavigation([page('a&role=admin/#中文')],'a&role=admin/#中文');assert.equal(special?.current.href,'/help-centre?article=a%26role%3Dadmin%2F%23%E4%B8%AD%E6%96%87');
});
