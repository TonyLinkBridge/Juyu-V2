import {test} from 'node:test';import assert from 'node:assert/strict';import {recentPage,recentResponse} from '../src/server/recent/http.ts';
test('recent collection pagination rejects duplicate values forged actors and invalid pages',()=>{
 assert.equal(recentPage(new URL('http://local/')),1);assert.equal(recentPage(new URL('http://local/?page=2')),2);
 for(const q of ['?page=0','?page=1&page=2','?member=other','?page=1e3','?page=1000000'])assert.throws(()=>recentPage(new URL('http://local/'+q)),/INVALID_INPUT/);
});
test('recent responses are private and never disclose backend failures',async()=>{
 for(const [message,status] of [['FORBIDDEN',403],['NOT_FOUND',404],['VERSION_CHANGED',409],['INVALID_INPUT',400],['SQL secret',503]] as const){const r=await recentResponse(async()=>{throw new Error(message)});assert.equal(r.status,status);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('vary'),'Cookie, Authorization');if(status===503)assert.deepEqual(await r.json(),{error:'RECENT_UNAVAILABLE'});}
});
