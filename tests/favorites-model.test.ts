import assert from 'node:assert/strict';
import {test} from 'node:test';
test('favorite input accepts only explicit desired state and a valid formal revision',async()=>{
 const {favoriteInput}=await import('../src/favorites/model.ts');
 for(const saved of [true,false])assert.deepEqual(favoriteInput({revision:1,saved}),{revision:1,saved});
 assert.deepEqual(favoriteInput({revision:2147483647,saved:true}),{revision:2147483647,saved:true});
 for(const input of [null,[],{},true,{revision:0,saved:true},{revision:1.2,saved:true},{revision:NaN,saved:true},{revision:2147483648,saved:true},{revision:'1',saved:true},{revision:1,saved:'true'},{revision:1},{saved:true},{revision:1,saved:true,memberId:'a'},{revision:1,saved:true,role:'admin'},{revision:1,saved:true,actor:'a'}])assert.throws(()=>favoriteInput(input),/INVALID_INPUT/);
});
