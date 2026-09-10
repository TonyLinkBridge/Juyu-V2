import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reviewResponse} from '../src/server/review/http.ts';
test('review responses are private and distinguish rejected submission from service uncertainty',async()=>{
 const ok=await reviewResponse(async()=>({status:'in_review'}));assert.equal(ok.headers.get('cache-control'),'private, no-store');
 for(const [code,status] of [['FORBIDDEN: current role',403],['NOT_REVIEWER',403],['REASON_REQUIRED',400],['EDIT_REQUIRED',409],['INVALID_APPROVAL',409],['INVALID_MEDIA',409],['NOT_FOUND',404],['CONFLICT',409],['INVALID_REVIEWER',409],['UPLOAD_IN_PROGRESS',409],['INVALID_STATE',409],['INACTIVE_DOCUMENT',409],['INVALID_INPUT',400],['UPLOAD_TOO_LARGE',413],['AUTH_NOT_CONFIGURED',503],['secret connection details',503]] as const){const r=await reviewResponse(async()=>{throw new Error(code);});assert.equal(r.status,status);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('vary'),'Cookie, Authorization');assert.ok(!(await r.text()).includes('secret'));}
});
