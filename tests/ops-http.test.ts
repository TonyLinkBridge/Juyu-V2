import test from 'node:test';import assert from 'node:assert/strict';
test('OPS request pages are exact and private failures do not leak service details',async()=>{
 const m=await import('../src/server/ops/http.ts').catch(()=>null);assert.equal(typeof m?.opsQuery,'function');if(!m)return;
 assert.equal(m.opsQuery(new URL('http://local/')),1);assert.equal(m.opsQuery(new URL('http://local/?page=3')),3);
 for(const query of ['page=0','page=01','page=1&page=2','role=ops','page=1.5','page=1000000'])assert.throws(()=>m.opsQuery(new URL(`http://local/?${query}`)),/INVALID_INPUT/);
 for(const [message,status,code] of [['FORBIDDEN',403,'FORBIDDEN'],['INVALID_INPUT',400,'INVALID_INPUT'],['database internal password',503,'OPS_UNAVAILABLE']] as const){const r=await m.opsResponse(async()=>{throw new Error(message);});assert.equal(r.status,status);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal((await r.json()).error,code);}
});
