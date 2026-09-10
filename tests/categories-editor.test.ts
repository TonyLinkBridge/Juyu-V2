import {test} from 'node:test';
import assert from 'node:assert/strict';
import {categoryState,categorySelection} from '../src/categories/editor.ts';
import type {CategoryDefinition} from '../src/categories/model.ts';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const def=(n:number,parentId:string|null=null,audience:CategoryDefinition['audience']='staff',enabled=true):CategoryDefinition=>({id:id(n),parentId,audience,enabled,name:`分类${n}`,position:n,version:1});
test('category editor inherits every ancestor restriction and preserves literal labels',()=>{
 const defs=[def(1,null,'ops'),def(2,id(1)),def(3,id(2),'admin')];
 assert.deepEqual(categoryState(defs,id(2)),{path:'分类1 / 分类2',enabled:true,audience:'ops'});
 assert.equal(categoryState(defs,id(3)).audience,'admin');
 assert.equal(categoryState([{...defs[0],enabled:false},defs[1]],id(2)).enabled,false);
 assert.equal(categoryState([def(1,id(2)),def(2,id(1))],id(1)).enabled,false);
 assert.equal(categoryState([def(2,id(1))],id(2)).enabled,false);
});
test('category editor selection rejects unknown or newly disabled IDs and retains old disabled memberships',()=>{
 const defs=[def(1),def(2,null,'ops',false)];
 assert.deepEqual(categorySelection(defs,[id(1)],[]),[id(1)]);
 assert.throws(()=>categorySelection(defs,[id(3)],[]),/INVALID_INPUT/);
 assert.throws(()=>categorySelection(defs,[id(2)],[]),/INVALID_INPUT/);
 assert.deepEqual(categorySelection(defs,[id(2)],[id(2)]),[id(2)]);
 assert.deepEqual(categorySelection(defs,[],[id(2)]),[]);
});
