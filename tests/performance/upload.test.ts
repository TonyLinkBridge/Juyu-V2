import {test} from 'node:test';import assert from 'node:assert/strict';
import {uploadFile,readBounded,mediaResponse} from '../../src/server/media/upload.ts';
import {summary,writeReport} from './report.ts';
const mib=1024*1024;
const request=(bytes:Uint8Array,name:string,signal?:AbortSignal)=>new Request('http://local/upload',{method:'POST',headers:{'content-type':'application/octet-stream','x-file-name':encodeURIComponent(name)},body:new Blob([new Uint8Array(bytes)]),signal});
function memoryStore(corrupt=false){let stored:Uint8Array;const states:boolean[]=[];let puts=0;return {states,get puts(){return puts;},deps:{authorize:async()=>{},reserve:async()=>{},finish:async(_id:string,ready:boolean)=>{states.push(ready);},storage:()=>({put:async(_key:string,stream:ReadableStream<Uint8Array>)=>{puts++;stored=new Uint8Array(await new Response(stream).arrayBuffer());},read:async()=>{const data=stored.slice();if(corrupt)data[data.length-1]^=1;return new Response(data,{headers:{'content-length':String(data.length)}});}})}};}
test('T058 maximum-size upload integrity, rejection, cancellation and process concurrency',{timeout:90000},async()=>{
 const result:Record<string,unknown>={scope:'Signature-valid synthetic bytes; local in-memory storage, not decodable media or Supabase throughput.'};
 try{
  for(const [name,size,signature,offset] of [['sample.csv',5*mib,'序号,说明\n',0],['sample.png',5*mib,'',0],['sample.pdf',20*mib,'%PDF-1.7',0],['sample.mp4',50*mib,'ftyp',4]] as const){
   const bytes=Buffer.alloc(size,65);if(name.endsWith('.png'))Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes);else bytes.write(signature,offset);
   const samples:number[]=[];for(let i=0;i<5;i++){const store=memoryStore();const start=performance.now();const ack=await uploadFile(request(bytes,name),'local',store.deps);samples.push(performance.now()-start);assert.equal(ack.size,String(size));assert.deepEqual(store.states,[true]);}
   result[name]={bytes:size,...summary(samples)};assert.ok(Math.max(...samples)<3000,`${name}: local processing exceeded 3s`);
   const tooLarge=memoryStore();const response=await mediaResponse(()=>uploadFile(request(Buffer.concat([bytes,Buffer.from('X')]),name),'local',tooLarge.deps));assert.equal(response.status,413);assert.equal(tooLarge.puts,0);assert.deepEqual(tooLarge.states,[]);
  }
  const corrupt=memoryStore(true);await assert.rejects(uploadFile(request(Buffer.from('保留中文'),'a.txt'),'local',corrupt.deps),/UPLOAD_UNCONFIRMED/);assert.deepEqual(corrupt.states,[false]);
  const denied=memoryStore();await assert.rejects(uploadFile(request(Buffer.from('safe'),'a.txt'),'local',{...denied.deps,authorize:async()=>{throw new Error('FORBIDDEN');}}),/FORBIDDEN/);assert.equal(denied.puts,0);
  const controller=new AbortController();let cancelled=false,started!:()=>void;const pulled=new Promise<void>(r=>started=r);const stream=new ReadableStream<Uint8Array>({pull(){started();},cancel(){cancelled=true;}});const read=readBounded(stream,50*mib,controller.signal);const rejection=assert.rejects(read);await pulled;controller.abort();await rejection;assert.equal(cancelled,true);
  let ready!:()=>void,release!:()=>void,count=0;const entered=new Promise<void>(r=>ready=r),hold=new Promise<void>(r=>release=r);const store=memoryStore();
  const deps={...store.deps,reserve:async()=>{if(++count===2)ready();await hold;}};
  const two=[uploadFile(request(Buffer.from('alpha'),'a.txt'),'local',deps),uploadFile(request(Buffer.from('alpha'),'b.txt'),'local',deps)];await entered;
  try{const busy=await mediaResponse(()=>uploadFile(request(Buffer.from('third'),'c.txt'),'local',store.deps));assert.equal(busy.status,429);assert.equal(count,2);}finally{release();}await Promise.all(two);
  const recovered=memoryStore();assert.equal((await uploadFile(request(Buffer.from('retry'),'r.txt'),'local',recovered.deps)).status,'ready');result.boundaries='passed: exact maxima, +1 byte, corrupt read-back, denied identity, abort, 2 active/third 429, recovery';
 }finally{result.maxProcessRssKiB=process.resourceUsage().maxRSS;await writeReport('upload',result);}
});
