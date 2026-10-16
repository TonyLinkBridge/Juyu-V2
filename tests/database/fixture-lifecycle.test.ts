import assert from 'node:assert/strict';
import {test} from 'node:test';
import {endPool,temporaryDatabase} from './fixture.ts';

test('ending an isolated database pool waits for the underlying clients to close',async()=>{
 const fixture=await temporaryDatabase();
 let removed=0;
 fixture.pool.on('remove',()=>{removed++;});
 try{
  await fixture.pool.query('SELECT 1');
  await endPool(fixture.pool);
  assert.ok(removed>0,'pool.end must not resolve before its client remove callbacks');
 }finally{
  await fixture.close();
 }
});

test('fixture shutdown waits for a checked-out client from every secondary pool',async()=>{
 const fixture=await temporaryDatabase();
 const password='secondary-fixture-password';
 await fixture.pool.query(`CREATE ROLE fixture_secondary LOGIN PASSWORD '${password}'`);
 const secondary=fixture.connectAs('fixture_secondary',password);
 await secondary.query('SELECT 1');
 const client=await secondary.connect();
 let closed=false,released=false;
 const closing=fixture.close().then(()=>{closed=true;});
 try{
  await new Promise(resolve=>setTimeout(resolve,100));
  assert.equal(closed,false,'fixture.close must wait for a checked-out secondary client');
  client.release();released=true;
  await closing;
  assert.equal(closed,true);
 }finally{
  if(!released)client.release();
  await closing;
 }
});
