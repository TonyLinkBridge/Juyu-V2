import assert from 'node:assert/strict';import {test} from 'node:test';import {referenceQuery,referenceResponse} from '../src/server/reference/http.ts';
test('Reference query rejects ambiguous page or article and responses never share private errors',async()=>{
 assert.deepEqual(referenceQuery(new URL('http://local/?page=2&article=ref')), {page:2,article:'ref',locale:'zh-CN'});
 for(const q of ['?page=0','?page=1&page=2','?article=a&article=b','?role=admin','?article=','?article=%00','?page=1e3','?lang=fr','?lang=en&lang=en'])assert.throws(()=>referenceQuery(new URL('http://local/'+q)),/INVALID_INPUT/);
 for(const [error,status] of [['FORBIDDEN',403],['NOT_FOUND',404],['INVALID_INPUT',400],['secret SQL details',503]] as const){const r=await referenceResponse(async()=>{throw new Error(error);});assert.equal(r.status,status);assert.equal(r.headers.get('cache-control'),'private, no-store');if(status===503)assert.deepEqual(await r.json(),{error:'REFERENCE_UNAVAILABLE'});}
});
