import assert from 'node:assert/strict';
import {test} from 'node:test';
import {buildNavigationTree,selectTreePage} from '../src/reader/tree.ts';
const pages=[{id:'one',title:'甲'},{id:'two',title:'乙'},{id:'free',title:'未分类'}];
const groups=[{id:'a',name:'主组',parent_id:null,position:1},{id:'b',name:'子组',parent_id:'a',position:0},{id:'c',name:'先显示',parent_id:null,position:0},{id:'empty',name:'空组',parent_id:null,position:0}];
const links=[{document_id:'one',category_id:'b'},{document_id:'two',category_id:'c'}];
test('tree follows saved group order and nesting and prunes empty categories',()=>{
 const tree=buildNavigationTree(pages,groups,links);
 assert.deepEqual(tree.map(n=>n.id),['c','a','free']);
 assert.equal(tree[1].type,'group');
 if(tree[1].type==='group')assert.equal(tree[1].descendants[0].id,'b');
 assert.equal(selectTreePage(tree,'one')?.title,'甲');
 assert.equal(selectTreePage(tree,'missing'),null);
 assert.equal(selectTreePage(tree,['one','two']),null);
});
test('multiple memberships appear once deterministically and stable IDs survive renaming',()=>{
 const membership=[...links,{document_id:'one',category_id:'c'}];
 const first=buildNavigationTree(pages,groups,membership);
 const second=buildNavigationTree([...pages].reverse(),groups.map(g=>({...g,name:'renamed'})).reverse(),membership.reverse());
 assert.equal(first[0].type,'group');assert.equal(second[0].id,'c');
 if(first[0].type==='group')assert.equal(first[0].descendants.filter(n=>n.id==='one').length,1);
 assert.deepEqual(first.map(n=>n.id),second.map(n=>n.id));
 assert.equal(selectTreePage(second,'one')?.href,'/help-centre?article=one');
});
test('missing or cyclic ancestors cannot promote categorized documents to the root',()=>{
 const broken=[{id:'x',name:'hidden',parent_id:'y',position:0},{id:'y',name:'hidden',parent_id:'x',position:0},{id:'orphan',name:'hidden',parent_id:'gone',position:0}];
 const tree=buildNavigationTree(pages,broken,[{document_id:'one',category_id:'x'},{document_id:'two',category_id:'orphan'}]);
 assert.deepEqual(tree.map(n=>n.id),['free']);
 assert.doesNotMatch(JSON.stringify(tree),/hidden/);
 const mixed=buildNavigationTree(pages,groups,[...links,{document_id:'one',category_id:'missing'}]);
 assert.equal(selectTreePage(mixed,'one'),null);
});
test('category and document identifiers may overlap without losing either node',()=>{
 const tree=buildNavigationTree([{id:'same',title:'article'}],[{id:'same',name:'category',parent_id:null,position:0}],[{document_id:'same',category_id:'same'}]);
 assert.equal(selectTreePage(tree,'same')?.title,'article');
});
test('English directory links keep the reader in English',()=>{
 const tree=buildNavigationTree([{id:'guide',title:'Getting started'}],[],[],{locale:'en'});
 assert.equal(selectTreePage(tree,'guide')?.href,'/help-centre?article=guide&lang=en');
});
