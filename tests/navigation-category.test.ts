import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNavigationTree} from '../src/reader/tree.ts';
import {categoryPage} from '../src/reader/category-page.ts';
import type {NavigationNode} from '../src/reader/tree.ts';
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const doc=(n:number):NavigationNode=>({type:'document',id:id(n),title:`资料 ${n}`,href:`/help-centre?article=${id(n)}`});
const tree:NavigationNode[]=[{type:'group',id:id(100),title:'运营流程',descendants:[doc(1),{type:'group',id:id(101),title:'升级处理',descendants:Array.from({length:21},(_,n)=>doc(n+2))}]}];
test('category destination uses only current authorized tree, preserves hierarchy and paginates current published items',()=>{
 const root=categoryPage(tree,id(100),1)!;assert.equal(root.title,'运营流程');assert.equal(root.total,22);assert.equal(root.pages,2);assert.equal(root.items.length,20);assert.deepEqual(root.ancestors,[]);
 const child=categoryPage(tree,id(101),999)!;assert.equal(child.page,2);assert.equal(child.items.length,1);assert.deepEqual(child.ancestors,[{id:id(100),title:'运营流程'}]);assert.equal(new Set([...root.items,...categoryPage(tree,id(100),2)!.items].map(x=>x.id)).size,22);
});
test('absent private categories reveal no label; direct available category remains readable independently of shortcuts',()=>{
 assert.equal(categoryPage([],id(100)),null);assert.equal(categoryPage(tree,id(999)),null);assert.equal(categoryPage(tree,id(1)),null);assert.equal(categoryPage(tree,id(101))?.title,'升级处理');
});
test('invalid category/page inputs fail closed rather than broadening into a root collection',()=>{
 for(const x of ['', '../ops',id(100).toUpperCase().replace('4000','FFFF')])assert.throws(()=>categoryPage(tree,x),/INVALID_INPUT/);
 for(const p of [0,-1,1.5,NaN,2147483647])assert.throws(()=>categoryPage(tree,id(100),p),/INVALID_INPUT/);
});

test('category collections retain every valid membership while normal article tree still shows each article once',()=>{
 const categories=[{id:id(100),name:'首分类',parent_id:null,position:0},{id:id(101),name:'次分类',parent_id:null,position:1}],memberships=[{document_id:id(1),category_id:id(100)},{document_id:id(1),category_id:id(101)}],documents=[{id:id(1),title:'共享资料'}];
 assert.equal(categoryPage(buildNavigationTree(documents,categories,memberships),id(101)),null);
 const collections=buildNavigationTree(documents,categories,memberships,{repeatMemberships:true});assert.equal(categoryPage(collections,id(101))?.items[0].id,id(1));assert.equal(categoryPage(collections,id(100))?.total,1);
 assert.deepEqual(buildNavigationTree(documents,categories,[...memberships,{document_id:id(1),category_id:id(999)}],{repeatMemberships:true}),[]);
});
