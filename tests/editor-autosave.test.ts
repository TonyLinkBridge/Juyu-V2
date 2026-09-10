import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DraftSaver} from '../src/editor/autosave.ts';
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
test('autosave serializes requests and keeps typing during save dirty',async()=>{
 const first=deferred<{sequence:number}>();const calls:{body:string;sequence:number|null}[]=[];
 const saver=new DraftSaver({body:'old'},2,async(value,sequence)=>{calls.push({...value,sequence});return calls.length===1?first.promise:{sequence:4};},()=>{},()=>{});
 assert.equal(typeof saver.update,'function');
 saver.update({body:'first'});const saving=saver.save();saver.update({body:'second'});await saver.save();assert.equal(calls.length,1);
 first.resolve({sequence:3});await saving;assert.equal(saver.state.dirty,true);assert.equal(saver.state.sequence,3);await saver.save();assert.deepEqual(calls,[{body:'first',sequence:2},{body:'second',sequence:3}]);assert.equal(saver.state.dirty,false);
});
test('failed or conflicting save retains input and revision until an explicit retry succeeds',async()=>{
 let fail=true;const saver=new DraftSaver({body:'old'},0,async()=>{if(fail)throw new Error('CONFLICT');return {sequence:1};},()=>{},()=>{});
 saver.update({body:'new'});await saver.save();assert.equal(saver.state.error,'CONFLICT');assert.equal(saver.state.dirty,true);assert.equal(saver.state.sequence,0);assert.equal(saver.state.blocked,true);
 fail=false;await saver.save(true);assert.equal(saver.state.dirty,false);assert.equal(saver.state.sequence,1);
});
test('ambiguous or invalid acknowledgements never mark new drafts saved',async()=>{
 const saver=new DraftSaver({title:''},null,async()=>({sequence:9}),()=>{},()=>{});saver.update({title:'new'});await saver.save();assert.equal(saver.state.dirty,true);assert.equal(saver.state.sequence,null);assert.equal(saver.state.error,'INVALID_ACK');
});
test('explicit retry replays the unconfirmed request before saving newer queued input',async()=>{
 const first=deferred<{sequence:number}>(),calls:{body:string;sequence:number|null}[]=[];
 const saver=new DraftSaver({body:'old'},2,async(value,sequence)=>{
  calls.push({...value,sequence});if(calls.length===1)return first.promise;
  return {sequence:calls.length===2?3:4};
 },()=>{},()=>{});
 saver.update({body:'A'});const saving=saver.save();saver.update({body:'B'});
 first.reject(new Error('NETWORK_ERROR'));await saving;
 await saver.save();assert.equal(calls.length,1);
 await saver.save(true);
 assert.deepEqual(calls,[{body:'A',sequence:2},{body:'A',sequence:2}]);
 assert.equal(saver.state.sequence,3);assert.equal(saver.state.dirty,true);assert.equal(saver.state.blocked,false);
 await saver.save();assert.deepEqual(calls.at(-1),{body:'B',sequence:3});assert.equal(saver.state.dirty,false);
});
test('invalid create acknowledgement keeps the original create snapshot for retry',async()=>{
 const calls:{title:string;sequence:number|null}[]=[];
 const saver=new DraftSaver({title:''},null,async(value,sequence)=>{
  calls.push({...value,sequence});return {sequence:calls.length===1?9:calls.length===2?0:1};
 },()=>{},()=>{});
 saver.update({title:'A'});await saver.save();saver.update({title:'B'});await saver.save(true);
 assert.deepEqual(calls,[{title:'A',sequence:null},{title:'A',sequence:null}]);
 assert.equal(saver.state.sequence,0);assert.equal(saver.state.dirty,true);
 await saver.save();assert.deepEqual(calls.at(-1),{title:'B',sequence:0});assert.equal(saver.state.dirty,false);
});
test('reverting local input cannot discard an unconfirmed write',async()=>{
 const calls:{body:string;sequence:number|null}[]=[];
 const saver=new DraftSaver({body:'old'},0,async(value,sequence)=>{
  calls.push({...value,sequence});if(calls.length===1)throw new Error('NETWORK_ERROR');return {sequence:calls.length-1};
 },()=>{},()=>{});
 saver.update({body:'A'});await saver.save();saver.update({body:'old'});
 assert.equal(saver.state.dirty,true);await saver.save(true);
 assert.deepEqual(calls,[{body:'A',sequence:0},{body:'A',sequence:0}]);assert.equal(saver.state.dirty,true);
 await saver.save();assert.deepEqual(calls.at(-1),{body:'old',sequence:1});assert.equal(saver.state.dirty,false);
});
test('confirmed server rejection discards the rejected payload so corrected input can be retried',async()=>{
 const {DraftSaveRejected}=await import('../src/editor/autosave.ts');
 const calls:{body:string;sequence:number|null}[]=[];
 const saver=new DraftSaver({body:'old'},4,async(value,sequence)=>{
  calls.push({...value,sequence});if(calls.length===1)throw new DraftSaveRejected('INVALID_INPUT');return {sequence:5};
 },()=>{},()=>{});
 saver.update({body:'invalid A'});await saver.save();
 assert.equal(saver.state.sequence,4);assert.equal(saver.state.dirty,true);assert.equal(saver.state.blocked,true);
 saver.update({body:'corrected B'});await saver.save();assert.equal(calls.length,1);
 await saver.save(true);
 assert.deepEqual(calls,[{body:'invalid A',sequence:4},{body:'corrected B',sequence:4}]);
 assert.equal(saver.state.sequence,5);assert.equal(saver.state.dirty,false);assert.equal(saver.state.blocked,false);
});
