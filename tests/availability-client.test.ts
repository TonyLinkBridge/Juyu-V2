import test from 'node:test';import assert from 'node:assert/strict';
test('availability ack validates action version lifecycle and removal of the formal pointer',async()=>{
 const m=await import('../src/availability/client.ts');assert.equal(typeof m.sendAvailability,'function');const old=globalThis.fetch;const input={action:'archive' as const,expectedSequence:5};const ack={documentId:'local',sequence:6,revision:2,action:'archive',lifecycle:'archived',status:'draft',publishedRevision:null};
 try{globalThis.fetch=async()=>Response.json(ack);assert.deepEqual(await m.sendAvailability('local',input,2),ack);
 for(const [k,v]of Object.entries({documentId:'other',sequence:7,revision:1,action:'unpublish',lifecycle:'active',status:'published',publishedRevision:1})){globalThis.fetch=async()=>Response.json({...ack,[k]:v});await assert.rejects(m.sendAvailability('local',input,2),/INVALID_ACK/);}
 globalThis.fetch=async()=>Response.json({error:'CONFLICT'},{status:409});await assert.rejects(m.sendAvailability('local',input,2),m.AvailabilityRejected);
 globalThis.fetch=async()=>Response.json({error:'UNKNOWN'},{status:503});await assert.rejects(m.sendAvailability('local',input,2),/UNKNOWN_RESULT/);
 }finally{globalThis.fetch=old;}
});
test('availability snapshots reject stale versions malformed history and impossible actions',async()=>{
 const m=await import('../src/availability/client.ts');const old=globalThis.fetch;const d={documentId:'local',title:'资料',sequence:5,revision:2,lifecycle:'active',status:'draft',publishedRevision:1,canArchive:true,canUnpublish:true,canUnarchive:false,history:[],historyMore:false};
 try{globalThis.fetch=async()=>Response.json(d);assert.deepEqual(await m.readAvailability('local',5),d);for(const patch of [{sequence:4},{revision:0},{documentId:'other'},{publishedRevision:null},{lifecycle:'trashed'},{canUnarchive:true},{history:[{}]},{historyMore:'true'}]){globalThis.fetch=async()=>Response.json({...d,...patch});await assert.rejects(m.readAvailability('local',5));}}finally{globalThis.fetch=old;}
});
test('availability busy rejection tells the user the operation did not execute and can refresh',async()=>{
 const m=await import('../src/availability/client.ts'),old=globalThis.fetch;
 try{globalThis.fetch=async()=>Response.json({error:'MEMBER_BUSY'},{status:409});let error:unknown;try{await m.sendAvailability('local',{action:'archive',expectedSequence:5},2);}catch(e){error=e;}assert.ok(error instanceof m.AvailabilityRejected);assert.match(m.availabilityError(error),/成员状态正在更新/);assert.match(m.availabilityError(error),/操作未执行/);assert.match(m.availabilityError(error),/重新读取/);
 globalThis.fetch=async()=>{throw new TypeError('Failed to fetch');};await assert.rejects(m.sendAvailability('local',{action:'archive',expectedSequence:5},2),e=>!(e instanceof m.AvailabilityRejected));}finally{globalThis.fetch=old;}
});
