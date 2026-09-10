import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { storageFixture } from './storage/http-fixture.ts';
import { SupabasePrivateStorage } from '../src/server/storage/supabase.ts';
import { deliverAsset } from '../src/server/storage/delivery.ts';
import { backupFiles, restoreFiles } from '../src/server/storage/backup.ts';

async function setup(){
  const fixture=await storageFixture();
  const store=new SupabasePrivateStorage(fixture.url,'test-only-key',{allowLoopback:true});
  const id=randomUUID();const bytes=Buffer.from('private PDF/video test bytes');
  await store.put(id,new Blob([bytes]).stream(),'application/pdf');
  const asset={id,document_id:'doc',filename:'中文说明.pdf',mime_type:'application/pdf',byte_size:String(bytes.length),bucket:'juyu-private',object_key:id};
  return {fixture,store,id,bytes,asset};
}

test('actual private bytes and ranges use safe headers, never an upstream public cache policy',async()=>{
  const t=await setup();try {
    const full=await deliverAsset(new Request('http://local/file'),t.id,async()=>t.asset,t.store);
    assert.equal(full.status,200);assert.deepEqual(Buffer.from(await full.arrayBuffer()),t.bytes);
    assert.equal(full.headers.get('cache-control'),'private, no-store');assert.equal(full.headers.get('content-type'),'application/pdf');
    assert.match(full.headers.get('content-disposition')??'',/filename\*=UTF-8''/);
    const part=await deliverAsset(new Request('http://local/file',{headers:{Range:'bytes=2-7'}}),t.id,async()=>t.asset,t.store);
    assert.equal(part.status,206);assert.deepEqual(Buffer.from(await part.arrayBuffer()),t.bytes.subarray(2,8));
    assert.equal(part.headers.get('content-range'),`bytes 2-7/${t.bytes.length}`);
  } finally {await t.fixture.close();}
});

test('revoked permission, guessed IDs and malformed ranges cannot cause an object read',async()=>{
  const t=await setup();try {
    const before=t.fixture.reads;
    assert.equal((await deliverAsset(new Request('http://local'),t.id,async()=>null,t.store)).status,404);
    assert.equal(t.fixture.reads,before);
    assert.equal((await deliverAsset(new Request('http://local',{headers:{Range:'bytes=0-2,4-8'}}),t.id,async()=>t.asset,t.store)).status,416);
    assert.equal(t.fixture.reads,before);
    assert.equal((await deliverAsset(new Request('http://local'),randomUUID(),async()=>null,t.store)).status,404);
  } finally {await t.fixture.close();}
});

test('a public bucket and active HTML/SVG cannot bypass private delivery rules',async()=>{
  const t=await setup();try {
    const response=await deliverAsset(new Request('http://local'),t.id,async()=>({...t.asset,mime_type:'image/svg+xml',filename:'bad\r\nname.svg'}),t.store);
    assert.equal(response.headers.get('content-type'),'application/octet-stream');assert.match(response.headers.get('content-disposition')??'',/^attachment;/);await response.arrayBuffer();
    t.fixture.setPublic(true);
    const blocked=await deliverAsset(new Request('http://local'),t.id,async()=>t.asset,t.store);
    assert.equal(blocked.status,502);assert.doesNotMatch(await blocked.text(),/test-only-key|127.0.0.1/);
  } finally {await t.fixture.close();}
});

test('storage adapter rejects arbitrary paths, insecure remote origins and overwrites',async()=>{
  assert.throws(()=>new SupabasePrivateStorage('http://remote.example','key'));
  const t=await setup();try {
    await assert.rejects(t.store.read('../secret'));
    await assert.rejects(t.store.put(t.id,new Blob(['replace']).stream(),'text/plain'));
    assert.deepEqual(await readFile(join(t.fixture.directory,t.id)),t.bytes);
  } finally {await t.fixture.close();}
});

test('file backup restores actual bytes and rejects corruption before any upload',async()=>{
  const t=await setup();const target=await storageFixture();const root=await mkdtemp(join(tmpdir(),'juyu-backup-test-'));
  const destination=new SupabasePrivateStorage(target.url,'test-only-key',{allowLoopback:true});
  try {
    const path=join(root,'backup');
    await backupFiles(t.store,[t.asset],path);
    const manifest=JSON.parse(await readFile(join(path,'manifest.json'),'utf8'));
    assert.equal(manifest.files.length,1);assert.match(manifest.files[0].sha256,/^[0-9a-f]{64}$/);
    await restoreFiles(destination,path);
    assert.deepEqual(await readFile(join(target.directory,t.id)),t.bytes);
    await writeFile(join(path,t.id),'corrupt');
    await assert.rejects(restoreFiles(destination,path),/BACKUP_INTEGRITY/);
    assert.deepEqual(await readFile(join(target.directory,t.id)),t.bytes);
  } finally {await t.fixture.close();await target.close();await rm(root,{recursive:true,force:true});}
});


test('healthy response streams can continue after the response-header timeout',async()=>{
  const t=await setup();try {
    t.fixture.setTailDelay(250);
    const store=new SupabasePrivateStorage(t.fixture.url,'test-only-key',{allowLoopback:true,headerTimeoutMs:100});
    const response=await store.read(t.id);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),t.bytes);
  } finally {await t.fixture.close();}
});


test('caller cancellation still aborts a streaming file response',async()=>{
  const t=await setup();try {
    t.fixture.setTailDelay(250);
    const controller=new AbortController();
    const response=await t.store.read(t.id,undefined,controller.signal);
    controller.abort();
    await assert.rejects(response.arrayBuffer());
  } finally {await t.fixture.close();}
});

test('a streaming upload may outlast the response-header timeout',async()=>{
  const fixture=await storageFixture();try {
    const store=new SupabasePrivateStorage(fixture.url,'test-only-key',{allowLoopback:true,headerTimeoutMs:100});
    const id=randomUUID();
    const body=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(Buffer.from('first'));setTimeout(()=>{controller.enqueue(Buffer.from('last'));controller.close();},250);}});
    await store.put(id,body,'text/plain');
    assert.equal(await readFile(join(fixture.directory,id),'utf8'),'firstlast');
  } finally {await fixture.close();}
});


test('explicit provisioning creates only a private bucket and never silently fixes a public bucket',async()=>{
  const fixture=await storageFixture();try {
    const store=new SupabasePrivateStorage(fixture.url,'test-only-key',{allowLoopback:true});
    fixture.setExists(false);await store.provisionPrivateBucket();
    await store.provisionPrivateBucket();
    fixture.setPublic(true);await assert.rejects(store.provisionPrivateBucket(),/PRIVATE_BUCKET_REQUIRED/);
  } finally {await fixture.close();}
});

test('takedown or identity change while storage responds prevents releasing full or ranged private bytes',async()=>{
 const t=await setup();try{
  for(const range of [undefined,'bytes=0-4'])for(const mode of ['removed','role','metadata']){
   let ready=false;const store={read:async(...args:Parameters<typeof t.store.read>)=>{const response=await t.store.read(...args);ready=true;return response;},put:t.store.put.bind(t.store)};
   const authorize=async()=>{if(!ready)return t.asset;if(mode==='role')throw new Error('FORBIDDEN');return mode==='removed'?null:{...t.asset,filename:'changed.pdf'};};
   const result=await deliverAsset(new Request('http://local/file',{headers:range?{Range:range}:{}}),t.id,authorize,store);
   assert.equal(result.status,mode==='removed'?404:mode==='role'?403:502);assert.equal(result.headers.get('cache-control'),'private, no-store');assert.doesNotMatch(await result.text(),/%PDF/);
  }
 }finally{await t.fixture.close();}
});
