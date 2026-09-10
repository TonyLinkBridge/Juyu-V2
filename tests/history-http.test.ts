import test from 'node:test';
import assert from 'node:assert/strict';
test('history pagination rejects unknown duplicated or malformed parameters',async()=>{
 const m=await import('../src/server/history/http.ts').catch(()=>null);assert.equal(typeof m?.historyQuery,'function');if(!m)return;
 assert.deepEqual(m.historyQuery(new URL('http://local/')), {eventPage:1,versionPage:1});
 assert.deepEqual(m.historyQuery(new URL('http://local/?eventPage=2&versionPage=3')), {eventPage:2,versionPage:3});
 for(const query of ['eventPage=0','eventPage=01','eventPage=1&eventPage=2','other=1','versionPage=1000000','eventPage=1.5'])assert.throws(()=>m.historyQuery(new URL(`http://local/?${query}`)),/INVALID_INPUT/);
 for(const value of ['0','01','-1','1.5','2147483648','no'])assert.throws(()=>m.historyRevision(value),/INVALID_INPUT/);
 assert.equal(m.historyRevision('2'),2);
});
test('history failures distinguish known rejection from unknown and keep private responses',async()=>{
 const m=await import('../src/server/history/http.ts').catch(()=>null);assert.equal(typeof m?.historyResponse,'function');if(!m)return;
 for(const [code,status] of [['MEMBER_BUSY',409],['INVALID_MEDIA',409],['CONFLICT',409],['FORBIDDEN',403],['NOT_FOUND',404],['INVALID_INPUT',400],['database password should stay hidden',503]] as const){const r=await m.historyResponse(async()=>{throw new Error(code);});assert.equal(r.status,status);assert.equal(r.headers.get('Cache-Control'),'private, no-store');assert.equal(r.headers.get('Vary'),'Cookie, Authorization');assert.equal((await r.json()).error,status===503?'HISTORY_UNAVAILABLE':code);}
 let calls=0;const r=await m.historyResponse(async()=>{calls++;return {ok:true};});assert.equal(calls,1);assert.deepEqual(await r.json(),{ok:true});
});
