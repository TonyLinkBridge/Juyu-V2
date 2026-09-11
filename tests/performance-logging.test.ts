import {test} from 'node:test';
import assert from 'node:assert/strict';
import {measured} from '../src/server/performance.ts';
test('performance logging is opt-in and never serializes work values or errors',async t=>{
 const previous=process.env.JUYU_PERFORMANCE_LOGGING;const lines:string[]=[];
 t.mock.method(console,'info',(line:string)=>lines.push(line));
 try{
  delete process.env.JUYU_PERFORMANCE_LOGGING;
  assert.equal(await measured('database.work',async()=>'private result'),'private result');assert.equal(lines.length,0);
  process.env.JUYU_PERFORMANCE_LOGGING='true';
  await measured('database.work',async()=>'private result');
  await assert.rejects(measured('database.work',async()=>{throw new Error('private secret');}),/private secret/);
  assert.equal(lines.length,2);
  const records=lines.map(line=>JSON.parse(line));
  assert.deepEqual(records.map(r=>r.ok),[true,false]);
  for(const r of records){assert.deepEqual(Object.keys(r).sort(),['event','ms','ok','stage']);assert.ok(r.ms>=0);}
  assert.ok(!lines.join('').includes('private'));
 }finally{if(previous===undefined)delete process.env.JUYU_PERFORMANCE_LOGGING;else process.env.JUYU_PERFORMANCE_LOGGING=previous;}
});
