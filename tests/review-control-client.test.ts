import test from 'node:test';
import assert from 'node:assert/strict';
import {readControl,sendControl,ControlRejected,controlError} from '../src/review/control-client.ts';
const detail={documentId:'control-local',title:'审核管理样例',sequence:4,revision:2,status:'in_review',lifecycle:'active',publishedRevision:1,submittedBy:'admin-a',reviewerId:'admin-b',reviewerName:'Ivy',reviewerAvailable:true,canManageReview:true,reviewers:[{id:'admin-c',name:'Sam'}],nextCursor:null,history:[],historyMore:false};
const input={expectedSequence:4,action:'reassign' as const,reviewerId:'admin-c'};
const ack={documentId:detail.documentId,sequence:5,revision:2,action:'reassign',status:'in_review',previousReviewerId:'admin-b',reviewerId:'admin-c'};
test('control sends exact payload and validates each acknowledgement field',async()=>{
 const original=globalThis.fetch;let sent='';try{
 globalThis.fetch=async(_url,options)=>{sent=String(options?.body);return Response.json(ack);};
 assert.deepEqual(await sendControl(detail.documentId,input,2,'admin-b'),ack);assert.equal(sent,JSON.stringify(input));
 for(const [key,value] of Object.entries({documentId:'other',sequence:6,revision:3,action:'withdraw',status:'draft',previousReviewerId:'other',reviewerId:'other'})){
  globalThis.fetch=async()=>Response.json({...ack,[key]:value});await assert.rejects(sendControl(detail.documentId,input,2,'admin-b'),/INVALID_ACK/);
 }
 globalThis.fetch=async()=>Response.json({error:'CONFLICT'},{status:409});await assert.rejects(sendControl(detail.documentId,input,2,'admin-b'),ControlRejected);
 globalThis.fetch=async()=>Response.json({error:'unavailable'},{status:503});await assert.rejects(sendControl(detail.documentId,input,2,'admin-b'),/UNKNOWN_RESULT/);
 }finally{globalThis.fetch=original;}
});
test('control read rejects stale or inconsistent snapshots and malformed candidate/history fields',async()=>{
 const original=globalThis.fetch;try{globalThis.fetch=async()=>Response.json(detail);assert.deepEqual(await readControl(detail.documentId,4),detail);
 for(const patch of [{sequence:3},{documentId:'other'},{reviewers:[{id:'admin-c'}]},{nextCursor:9},{history:[{}]},{history:[{sequence:4,revision:2,action:'reassign',actorId:'admin-a',previousReviewerId:'admin-z',reviewerId:'admin-b',at:'2026-09-09T01:00:00Z'}]},{reviewers:Array.from({length:31},(_,i)=>({id:`candidate-${i}`,name:'Sam'}))},{status:'draft',canManageReview:true},{reviewerId:null,canManageReview:true}]){
 globalThis.fetch=async()=>Response.json({...detail,...patch});await assert.rejects(readControl(detail.documentId,4),/READ_FAILED/);
 }
 }finally{globalThis.fetch=original;}
});
test('definite rejected inputs require rereading while unknown results require exact retry',()=>{
 assert.match(controlError(new ControlRejected('INVALID_INPUT')),/操作未执行.*重新读取/);
 assert.match(controlError(new Error('UNKNOWN_RESULT')),/尚未确认.*重试原操作/);
});
