import {test} from 'node:test';
import assert from 'node:assert/strict';
import {availabilityResponse} from '../src/server/availability/http.ts';
import {reviewResponse} from '../src/server/review/http.ts';
test('availability responses distinguish the known pre-write member lock rejection from unknown results',async()=>{
 const busy=await availabilityResponse(async()=>{throw new Error('MEMBER_BUSY');});assert.equal(busy.status,409);assert.deepEqual(await busy.json(),{error:'MEMBER_BUSY'});assert.equal(busy.headers.get('cache-control'),'private, no-store');assert.equal(busy.headers.get('vary'),'Cookie, Authorization');
 const unknown=await availabilityResponse(async()=>{throw new Error('private upstream failure');});assert.equal(unknown.status,503);assert.deepEqual(await unknown.json(),{error:'REVIEW_UNAVAILABLE'});assert.equal(unknown.headers.get('cache-control'),'private, no-store');assert.equal(unknown.headers.get('vary'),'Cookie, Authorization');
 const oldBoundary=await reviewResponse(async()=>{throw new Error('MEMBER_BUSY');});assert.equal(oldBoundary.status,503);assert.deepEqual(await oldBoundary.json(),{error:'REVIEW_UNAVAILABLE'});
 let calls=0;const value={documentId:'document',sequence:6};const success=await availabilityResponse(async()=>{calls++;return value;});assert.equal(calls,1);assert.deepEqual(await success.json(),value);assert.equal(success.headers.get('cache-control'),'private, no-store');
 const forbidden=await availabilityResponse(async()=>{throw new Error('FORBIDDEN: current role');});assert.equal(forbidden.status,403);assert.deepEqual(await forbidden.json(),{error:'FORBIDDEN'});
});
