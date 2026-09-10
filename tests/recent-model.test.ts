import assert from 'node:assert/strict';
import {test} from 'node:test';
test('recent input accepts only a positive integer formal revision and rejects client actor or clock overrides',async()=>{
 const {recentInput}=await import('../src/recent/model.ts');
 for(const revision of [1,2147483647])assert.deepEqual(recentInput({revision}),{revision});
 for(const input of [null,[],{},true,{revision:0},{revision:-1},{revision:1.2},{revision:NaN},{revision:2147483648},{revision:'1'},{revision:1,viewedAt:'2020-01-01'},{revision:1,memberId:'a'},{revision:1,role:'admin'},{revision:1,actor:'a'}])assert.throws(()=>recentInput(input),/INVALID_INPUT/);
});
