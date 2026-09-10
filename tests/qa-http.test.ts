import assert from 'node:assert/strict';import {test} from 'node:test';import {qaQuery,qaResponse} from '../src/server/qa/http.ts';
test('Q&A query distinguishes all and unclassified and rejects ambiguous inputs',()=>{
 assert.deepEqual(qaQuery(new URL('http://local/')),{page:1});assert.deepEqual(qaQuery(new URL('http://local/?category=')),{page:1,category:''});assert.deepEqual(qaQuery(new URL('http://local/?page=2&category=%E8%B4%A6%E6%88%B7')),{page:2,category:'账户'});
 for(const q of ['?page=0','?page=1&page=2','?category=a&category=b','?role=admin','?category=%00','?page=1e3','?category='+encodeURIComponent('字'.repeat(81))])assert.throws(()=>qaQuery(new URL('http://local/'+q)),/INVALID_INPUT/);
});
test('Q&A errors never expose backend detail and responses cannot be shared',async()=>{
 for(const [error,status] of [['FORBIDDEN',403],['INVALID_INPUT',400],['secret SQL details',503]] as const){const r=await qaResponse(async()=>{throw new Error(error);});assert.equal(r.status,status);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('vary'),'Cookie, Authorization');if(status===503)assert.deepEqual(await r.json(),{error:'QA_UNAVAILABLE'});}
});
