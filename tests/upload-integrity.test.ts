import {test} from 'node:test';import assert from 'node:assert/strict';
import {uploadMetadata} from '../src/media/model.ts';import {uploadFile,readBounded} from '../src/server/media/upload.ts';
test('upload metadata respects a sliced byte view without touching surrounding bytes',()=>{
 const wrapped=Buffer.from([0,65,66,67,0]);const original=Buffer.from(wrapped);const bytes=new Uint8Array(wrapped.buffer,wrapped.byteOffset+1,3);
 assert.deepEqual(uploadMetadata('sample.txt',bytes),{filename:'sample.txt',mime:'text/plain',size:3});assert.deepEqual(wrapped,original);
});
test('upload integrity validates all streamed readback chunks and rejects incomplete or altered content',async()=>{
 const source=Buffer.from('中文上传：核对所有分段，不只核对开头。');
 for(const mode of ['valid','changed-tail','truncated','oversized','aborted'] as const){
  const controller=new AbortController(),states:boolean[]=[];let cancelled=false;let readback=Buffer.from(source);
  if(mode==='changed-tail')readback[readback.length-1]^=1;
  if(mode==='truncated')readback=readback.subarray(0,-1);
  if(mode==='oversized')readback=Buffer.concat([readback,Buffer.from('X')]);
  const request=new Request('http://local',{method:'POST',signal:controller.signal,headers:{'content-type':'application/octet-stream','x-file-name':'sample.txt'},body:source});let offset=0;
  const action=uploadFile(request,'local',{authorize:async()=>{},reserve:async()=>{},finish:async(_id,ready)=>{states.push(ready);},storage:()=>({put:async(_id,body)=>{assert.deepEqual(Buffer.from(await new Response(body).arrayBuffer()),source);},read:async()=>new Response(new ReadableStream<Uint8Array>({pull(c){if(offset===readback.length){c.close();return;}const end=Math.min(offset+3,readback.length);c.enqueue(readback.subarray(offset,end));offset=end;if(mode==='aborted')controller.abort();},cancel(){cancelled=true;}}),{headers:{'content-length':String(source.length)}})})});
  if(mode==='valid'){assert.equal((await action).status,'ready');assert.deepEqual(states,[true]);}else{await assert.rejects(action);assert.deepEqual(states,[false]);if(mode==='aborted')assert.equal(cancelled,true);}
 }
});
test('bounded read stops and cancels a stream exceeding its limit',async()=>{
 let cancelled=false,pulls=0;const body=new ReadableStream<Uint8Array>({pull(c){pulls++;c.enqueue(new Uint8Array(4));},cancel(){cancelled=true;}});
 await assert.rejects(readBounded(body,5,new AbortController().signal),/UPLOAD_TOO_LARGE/);assert.equal(cancelled,true);assert.ok(pulls<=3);assert.equal(body.locked,false);
});
