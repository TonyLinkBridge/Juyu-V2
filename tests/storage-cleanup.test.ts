import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {storageFixture} from './storage/http-fixture.ts';
import {SupabasePrivateStorage} from '../src/server/storage/supabase.ts';

async function setup(){
  const fixture=await storageFixture();
  const store=new SupabasePrivateStorage(fixture.url,'test-only-key',{allowLoopback:true});
  const key=randomUUID();
  await store.put(key,new Blob(['private fixture']).stream(),'text/plain');
  return {fixture,store,key,job:{id:randomUUID(),object_key:key,bucket:'juyu-private'}};
}

test('private removal verifies actual absence and succeeds again for an already absent object',async()=>{
  const t=await setup();try{
    assert.equal(await (await t.store.read(t.key)).text(),'private fixture');
    assert.equal(typeof t.store.remove,'function');
    await t.store.remove(t.key);
    await assert.rejects(readFile(join(t.fixture.directory,t.key)),{code:'ENOENT'});
    await assert.rejects(t.store.read(t.key),/PRIVATE_OBJECT_UNAVAILABLE/);
    await t.store.remove(t.key);
  }finally{await t.fixture.close();}
});

test('failed delete and ambiguous absence never count as a completed removal',async()=>{
  const t=await setup();try{
    t.fixture.setDeleteStatus(500);
    await assert.rejects(t.store.remove(t.key),/PRIVATE_OBJECT_DELETE_FAILED/);
    assert.equal(await readFile(join(t.fixture.directory,t.key),'utf8'),'private fixture');
    t.fixture.setDeleteStatus(200);t.fixture.setRetainDeleted(true);
    await assert.rejects(t.store.remove(t.key),/PRIVATE_OBJECT_DELETE_UNVERIFIED/);
    t.fixture.setRetainDeleted(false);t.fixture.setVerificationStatus(403);
    await assert.rejects(t.store.remove(t.key),/PRIVATE_OBJECT_DELETE_UNVERIFIED/);
    t.fixture.setVerificationStatus(500);
    await assert.rejects(t.store.remove(t.key),/PRIVATE_OBJECT_DELETE_UNVERIFIED/);
    t.fixture.setVerificationStatus(0);
    await t.store.remove(t.key);
  }finally{await t.fixture.close();}
});

test('removal rejects paths, public buckets and cancelled operations before changing bytes',async()=>{
  const t=await setup();try{
    await assert.rejects(t.store.remove('../secret'),/INVALID_OBJECT_KEY/);
    t.fixture.setPublic(true);
    await assert.rejects(t.store.remove(t.key),/PRIVATE_BUCKET_REQUIRED/);
    t.fixture.setPublic(false);
    await assert.rejects(t.store.remove(t.key,AbortSignal.abort()));
    assert.equal(await readFile(join(t.fixture.directory,t.key),'utf8'),'private fixture');
  }finally{await t.fixture.close();}
});

test('cleanup leaves partial failure pending and retries after deletion or persistence failure',async()=>{
  const {runStorageCleanup}=await import('../src/server/storage/cleanup.ts');
  const t=await setup();try{
    const invalid={id:randomUUID(),object_key:'../secret',bucket:'juyu-private'};
    const completed:string[]=[];
    const finish=async(id:string)=>{completed.push(id);};
    t.fixture.setDeleteStatus(500);
    assert.deepEqual(await runStorageCleanup([t.job,invalid],t.store,finish),{attempted:2,completed:0,pending:2});
    assert.deepEqual(completed,[]);
    t.fixture.setDeleteStatus(200);
    assert.deepEqual(await runStorageCleanup([t.job,invalid],t.store,finish),{attempted:2,completed:1,pending:1});
    assert.deepEqual(completed,[t.job.id]);
    assert.deepEqual(await runStorageCleanup([t.job],t.store,async()=>{throw Error('database unavailable');}),{attempted:1,completed:0,pending:1});
    assert.deepEqual(await runStorageCleanup([t.job],t.store,finish),{attempted:1,completed:1,pending:0});
  }finally{await t.fixture.close();}
});

test('cleanup bounds work and leaves unavailable providers, invalid buckets and aborted work pending',async()=>{
  const {runStorageCleanup}=await import('../src/server/storage/cleanup.ts');
  const t=await setup();try{
    const finish=async()=>{};
    const unavailable={read:t.store.read.bind(t.store),put:t.store.put.bind(t.store)};
    assert.deepEqual(await runStorageCleanup([t.job],unavailable,finish),{attempted:1,completed:0,pending:1});
    assert.deepEqual(await runStorageCleanup([{...t.job,bucket:'public'}],t.store,finish),{attempted:1,completed:0,pending:1});
    assert.equal(await readFile(join(t.fixture.directory,t.key),'utf8'),'private fixture');
    assert.deepEqual(await runStorageCleanup([t.job],t.store,finish,AbortSignal.abort()),{attempted:0,completed:0,pending:1});
    const jobs=Array.from({length:30},()=>({id:randomUUID(),object_key:randomUUID(),bucket:'juyu-private'}));
    assert.deepEqual(await runStorageCleanup(jobs,t.store,finish),{attempted:25,completed:25,pending:5});
  }finally{await t.fixture.close();}
});


test('cleanup returns pending if a provider or persistence callback ignores cancellation',async()=>{
  const {runStorageCleanup}=await import('../src/server/storage/cleanup.ts');
  const t=await setup();try{
    for(const phase of ['remove','finish']){
      const store={read:t.store.read.bind(t.store),put:t.store.put.bind(t.store),remove:phase==='remove'?async()=>new Promise<void>(()=>{}):t.store.remove.bind(t.store)};
      const finish=phase==='finish'?async()=>new Promise<void>(()=>{}):async()=>{};
      const operation=runStorageCleanup([t.job],store,finish,AbortSignal.timeout(30));
      let timer:ReturnType<typeof setTimeout>;
      const limit=new Promise<string>(resolve=>{timer=setTimeout(()=>resolve('hung past cancellation'),200);});
      try{assert.deepEqual(await Promise.race([operation,limit]),{attempted:1,completed:0,pending:1});}finally{clearTimeout(timer!);}
    }
  }finally{await t.fixture.close();}
});


test('Supabase documented NoSuchKey HTTP 400 confirms absence without treating arbitrary 400 as missing',async()=>{
  const t=await setup();try{
    for(const body of [
      {statusCode:'404',code:'NoSuchKey',error:'not_found',message:'Object not found'},
      {statusCode:'404',code:'NoSuchKey',error:'NoSuchKey',message:'Object not found'},
      {code:'NoSuchKey',message:'Object not found'},
    ]){
      t.fixture.setVerificationResponse(400,JSON.stringify(body));
      await t.store.remove(t.key);
      await assert.rejects(readFile(join(t.fixture.directory,t.key)),{code:'ENOENT'});
    }
  }finally{await t.fixture.close();}
});

test('malformed, contradictory and non-object-missing HTTP 400 errors retain pending cleanup',async()=>{
  const {runStorageCleanup}=await import('../src/server/storage/cleanup.ts');
  const t=await setup();try{
    for(const body of [
      '', '<html>not_found</html>', 'null', JSON.stringify({statusCode:'404'}),
      JSON.stringify({code:'NoSuchBucket',statusCode:'404'}),
      JSON.stringify({code:'AccessDenied',statusCode:'403'}),
      JSON.stringify({code:'InvalidRequest',message:'Object not found'}),
      JSON.stringify({code:'NoSuchKey',statusCode:'403'}),
      JSON.stringify({code:'NoSuchKey',error:'AccessDenied'}),
      JSON.stringify({code:'NoSuchKey',httpStatusCode:403}),
      JSON.stringify({code:'NoSuchKey',message:'x'.repeat(9000)}),
    ]){
      t.fixture.setVerificationResponse(400,body);
      assert.deepEqual(await runStorageCleanup([t.job],t.store,async()=>assert.fail('unverified cleanup persisted')),{attempted:1,completed:0,pending:1});
    }
  }finally{await t.fixture.close();}
});


test('cleanup starts only visited jobs so an unstarted third job leads the next retry after budget exhaustion',async()=>{
  const {runStorageCleanup}=await import('../src/server/storage/cleanup.ts');
  const t=await setup();try{
    const jobs=[t.job,{id:randomUUID(),object_key:randomUUID(),bucket:'juyu-private'},{id:randomUUID(),object_key:randomUUID(),bucket:'juyu-private'}];
    await t.store.put(jobs[1].object_key,new Blob(['second']).stream(),'text/plain');
    await t.store.put(jobs[2].object_key,new Blob(['third']).stream(),'text/plain');
    const attempts=new Map<string,number>();
    const completed=new Set<string>();
    let sequence=0;
    const onAttempt=async(id:string)=>{attempts.set(id,++sequence);};
    const finish=async(id:string)=>{completed.add(id);};
    const controller=new AbortController();
    const firstBatchStore={read:t.store.read.bind(t.store),put:t.store.put.bind(t.store),remove:async(key:string)=>{
      await new Promise(resolve=>setTimeout(resolve,5));
      if(key===jobs[1].object_key)controller.abort(new DOMException('batch expired','TimeoutError'));
      throw new DOMException('object expired','TimeoutError');
    }};
    assert.deepEqual(await runStorageCleanup(jobs,firstBatchStore,finish,controller.signal,onAttempt),{attempted:2,completed:0,pending:3});
    assert.deepEqual([...attempts.keys()],[jobs[0].id,jobs[1].id]);
    assert.equal(await readFile(join(t.fixture.directory,jobs[2].object_key),'utf8'),'third');
    const nextJobs=[...jobs].sort((a,b)=>(attempts.get(a.id)??0)-(attempts.get(b.id)??0));
    assert.equal(nextJobs[0].id,jobs[2].id);
    // Execute the next authorized item through the actual HTTP provider and its disk fixture.
    assert.deepEqual(await runStorageCleanup(nextJobs.slice(0,1),t.store,finish,undefined,onAttempt),{attempted:1,completed:1,pending:0});
    assert.deepEqual([...completed],[jobs[2].id]);
    await assert.rejects(readFile(join(t.fixture.directory,jobs[2].object_key)),{code:'ENOENT'});
    assert.equal(await readFile(join(t.fixture.directory,jobs[0].object_key),'utf8'),'private fixture');
  }finally{await t.fixture.close();}
});

test('failed or stalled attempt persistence cannot begin private-object deletion',async()=>{
  const {runStorageCleanup}=await import('../src/server/storage/cleanup.ts');
  const t=await setup();try{
    const completed:string[]=[];
    const finish=async(id:string)=>{completed.push(id);};
    for(const onAttempt of [async()=>{throw Error('attempt denied');},async()=>new Promise<void>(()=>{})]){
      let timer:ReturnType<typeof setTimeout>;
      const limit=new Promise<string>(resolve=>{timer=setTimeout(()=>resolve('hung attempt callback'),200);});
      try{
        const run=runStorageCleanup([t.job],t.store,finish,AbortSignal.timeout(30),onAttempt);
        assert.deepEqual(await Promise.race([run,limit]),{attempted:1,completed:0,pending:1});
      }finally{clearTimeout(timer!);}
      assert.equal(await readFile(join(t.fixture.directory,t.key),'utf8'),'private fixture');
      assert.deepEqual(completed,[]);
    }
  }finally{await t.fixture.close();}
});
