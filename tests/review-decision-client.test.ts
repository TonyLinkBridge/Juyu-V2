import test from 'node:test';
import assert from 'node:assert/strict';
import {decisionInput} from '../src/review/decision.ts';
import {loadComponent} from './helpers/render-component.ts';
const {sendDecision}=loadComponent('src/review/decision-client.ts') as {sendDecision:(id:string,input:unknown,revision:number,reviewer:string)=>Promise<unknown>};
test('combined approval is explicit and rejects reason injection and sequence overflow',()=>{
 assert.deepEqual(decisionInput({expectedSequence:1,action:'approve_publish'}),{expectedSequence:1,action:'approve_publish'});
 for(const input of [{expectedSequence:1,action:'approve_publish',reason:'hidden'},{expectedSequence:2147483645,action:'approve_publish'},{expectedSequence:1,action:'approve_publish',reviewerId:'fake'}])assert.throws(()=>decisionInput(input),/INVALID_INPUT/);
});
test('combined approval validates the final publication and all three committed sequence steps',async()=>{
 const original=globalThis.fetch;
 const input={expectedSequence:1,action:'approve_publish'},ack={documentId:'test-only',sequence:4,revision:1,reviewerId:'reviewer',status:'published',action:'approve_publish',reason:null,publishedRevision:1};
 try{
  globalThis.fetch=async()=>Response.json(ack);assert.deepEqual(await sendDecision('test-only',input,1,'reviewer'),ack);
  for(const patch of [{sequence:2},{status:'approved'},{publishedRevision:null},{publishedRevision:2},{reviewerId:'fake'},{action:'approve'},{documentId:'other'}]){globalThis.fetch=async()=>Response.json({...ack,...patch});await assert.rejects(sendDecision('test-only',input,1,'reviewer'),/INVALID_ACK/);}
 }finally{globalThis.fetch=original;}
});
