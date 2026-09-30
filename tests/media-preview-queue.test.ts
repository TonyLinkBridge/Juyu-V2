import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createPreviewQueue} from '../src/media/preview-queue.ts';

test('cancelled queued previews do not fetch after a user leaves the view',async()=>{
 const queue=createPreviewQueue(1),first=new AbortController(),cancelled=new AbortController(),next=new AbortController();
 let finish!:()=>void;const held=new Promise<void>(resolve=>{finish=resolve;});const calls:string[]=[];
 const a=queue.run(first.signal,async()=>{calls.push('first');await held;return 'a';});
 const b=queue.run(cancelled.signal,async()=>{calls.push('cancelled');return 'b';});
 const rejected=assert.rejects(b,{name:'AbortError'});
 const c=queue.run(next.signal,async()=>{calls.push('next');return 'c';});
 cancelled.abort();await rejected;finish();
 assert.deepEqual(await Promise.all([a,c]),['a','c']);assert.deepEqual(calls,['first','next']);
});
test('a failed preview releases its slot so other files still load',async()=>{
 const queue=createPreviewQueue(1),signal=new AbortController().signal;
 const failure=queue.run(signal,async()=>{throw new Error('FILE_UNAVAILABLE');});
 const success=queue.run(signal,async()=> 'ready');
 await assert.rejects(failure,/FILE_UNAVAILABLE/);assert.equal(await success,'ready');
});
