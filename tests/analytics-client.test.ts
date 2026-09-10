import {test} from 'node:test';import assert from 'node:assert/strict';import {postAnalytics,deliverAnalytics} from '../src/analytics/client.ts';
const input={kind:'view' as const,eventId:'00000000-0000-4000-8000-000000000001',documentId:'a',revision:1};
test('analytics sends only a bounded event with keepalive and validates matching acknowledgements',async()=>{
 const old=globalThis.fetch;let init:RequestInit|undefined;globalThis.fetch=async(_,options)=>{init=options;return Response.json({eventId:input.eventId,kind:'view'});};try{assert.deepEqual(await postAnalytics(input),{eventId:input.eventId,kind:'view'});assert.equal(init?.keepalive,true);assert.equal(init?.credentials,'same-origin');assert.deepEqual(JSON.parse(String(init?.body)),input);for(const patch of [{eventId:'other'},{kind:'search'},{}]){globalThis.fetch=async()=>Response.json(patch);await assert.rejects(postAnalytics(input),/INVALID_ACK/);}}finally{globalThis.fetch=old;}
});
test('analytics transient failure retries the identical event once and final failure is contained',async()=>{
 const old=globalThis.fetch;const bodies:string[]=[];globalThis.fetch=async(_,init)=>{bodies.push(String(init?.body));throw new Error('offline');};try{await new Promise<void>(resolve=>{deliverAnalytics(input,{delayMs:1,onSettled:resolve});});assert.equal(bodies.length,2);assert.equal(bodies[0],bodies[1]);}finally{globalThis.fetch=old;}
});
test('analytics cancellation stops scheduled retries and definite rejections do not loop',async()=>{
 const old=globalThis.fetch;let count=0;globalThis.fetch=async()=>{count++;return Response.json({error:'FORBIDDEN'},{status:403});};try{await new Promise<void>(resolve=>deliverAnalytics(input,{delayMs:1,onSettled:resolve}));assert.equal(count,1);globalThis.fetch=async()=>{count++;throw new Error('offline');};const stop=deliverAnalytics(input,{delayMs:20});stop();await new Promise(r=>setTimeout(r,40));assert.equal(count,2);}finally{globalThis.fetch=old;}
});
