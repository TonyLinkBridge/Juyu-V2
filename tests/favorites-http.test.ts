import {test} from 'node:test';import assert from 'node:assert/strict';import {favoritesPage,favoriteRevision,favoritesResponse} from '../src/server/favorites/http.ts';
test('favorites request parsing rejects duplicate or forged identity parameters',()=>{
 assert.equal(favoritesPage(new URL('http://local/')),1);assert.equal(favoritesPage(new URL('http://local/?page=2')),2);assert.equal(favoriteRevision(new URL('http://local/?revision=3')),3);
 for(const q of ['?page=0','?page=1&page=2','?member=other','?page=1e3'])assert.throws(()=>favoritesPage(new URL('http://local/'+q)),/INVALID_INPUT/);
 for(const q of ['', '?revision=0','?revision=1&revision=2','?revision=1&role=admin','?revision=2147483648'])assert.throws(()=>favoriteRevision(new URL('http://local/'+q)),/INVALID_INPUT/);
});
test('favorites responses never cache or disclose backend errors',async()=>{
 for(const [message,status] of [['FORBIDDEN',403],['NOT_FOUND',404],['VERSION_CHANGED',409],['INVALID_INPUT',400],['SQL secret',503]] as const){const r=await favoritesResponse(async()=>{throw new Error(message)});assert.equal(r.status,status);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('vary'),'Cookie, Authorization');if(status===503)assert.deepEqual(await r.json(),{error:'FAVORITES_UNAVAILABLE'});}
});
