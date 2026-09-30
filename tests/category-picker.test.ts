import test from 'node:test';
import assert from 'node:assert/strict';
import {visibleCategoryOptions} from '../src/categories/editor.ts';
import type {CategoryDefinition} from '../src/categories/model.ts';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const definitions:CategoryDefinition[]=[
 {id:id(1),version:1,name:'会员',parentId:null,position:0,audience:'staff',enabled:true},
 {id:id(2),version:1,name:'会员权益',parentId:id(1),position:0,audience:'staff',enabled:true},
 {id:id(3),version:1,name:'普通会员',parentId:id(2),position:0,audience:'staff',enabled:false},
 {id:id(4),version:1,name:'账户管理',parentId:null,position:1,audience:'staff',enabled:true},
];
test('category picker hides inactive unassigned nodes',()=>{
 assert.deepEqual(visibleCategoryOptions(definitions,[]).map(item=>item.id),[id(1),id(2),id(4)]);
});
test('category picker keeps an inactive assigned node so it can be removed',()=>{
 assert.deepEqual(visibleCategoryOptions(definitions,[id(3)]).map(item=>item.id),[id(1),id(2),id(3),id(4)]);
});
