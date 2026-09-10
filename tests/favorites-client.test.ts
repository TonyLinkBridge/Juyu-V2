import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFavoriteState,setFavoriteState,FavoriteRejected} from '../src/favorites/client.ts';
test('favorite client reads current private state and sends an explicit desired value without identity claims',async()=>{
 const old=globalThis.fetch;const calls:{url:string;init?:RequestInit}[]=[];globalThis.fetch=async(url,init)=>{calls.push({url:String(url),init});return Response.json({documentId:'a/b',revision:3,saved:init?.method==='PUT'});};
 try{assert.equal((await readFavoriteState('a/b',3)).saved,false);assert.equal((await setFavoriteState('a/b',3,true)).saved,true);assert.equal(calls[0].url,'/api/favorites/a%2Fb?revision=3');assert.equal(calls[0].init?.cache,'no-store');assert.equal(calls[1].init?.method,'PUT');assert.deepEqual(JSON.parse(String(calls[1].init?.body)),{revision:3,saved:true});}finally{globalThis.fetch=old;}
});
test('favorite client rejects wrong document revision or desired-state acknowledgements',async()=>{
 const old=globalThis.fetch;try{for(const patch of [{documentId:'other'},{revision:4},{saved:'true'},{saved:false}]){globalThis.fetch=async()=>Response.json({documentId:'a',revision:3,saved:true,...patch});await assert.rejects(setFavoriteState('a',3,true),/INVALID_ACK/);}}finally{globalThis.fetch=old;}
});
test('favorite client distinguishes definite rejection from an unknown write result',async()=>{
 const old=globalThis.fetch;try{globalThis.fetch=async()=>Response.json({error:'VERSION_CHANGED'},{status:409});await assert.rejects(setFavoriteState('a',3,true),FavoriteRejected);globalThis.fetch=async()=>Response.json({error:'UNAVAILABLE'},{status:503});await assert.rejects(setFavoriteState('a',3,true),e=>e instanceof Error&&!(e instanceof FavoriteRejected));globalThis.fetch=async()=>{throw new Error('network')};await assert.rejects(setFavoriteState('a',3,true),e=>e instanceof Error&&!(e instanceof FavoriteRejected));}finally{globalThis.fetch=old;}
});
