import {test} from 'node:test';import assert from 'node:assert/strict';
import {lifecycleResponse} from '../src/server/lifecycle/http.ts';
test('lifecycle endpoints never cache private results or expose underlying failures',async()=>{
 const ok=await lifecycleResponse(async()=>({action:'trash'}));assert.equal(ok.headers.get('cache-control'),'private, no-store');
 for(const [code,status] of [['FORBIDDEN',403],['CONFLICT',409],['UPLOAD_IN_PROGRESS',409],['INVALID_STATE',409],['CONFIRMATION_REQUIRED',400],['NOT_FOUND',404],['AUTH_NOT_CONFIGURED',503],['database password internal',503]] as const){const r=await lifecycleResponse(async()=>{throw new Error(code);});assert.equal(r.status,status);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.ok(!(await r.text()).includes('password'));}
});
