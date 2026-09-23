import test from 'node:test';
import assert from 'node:assert/strict';
const detail={article:{documentId:'release-local',title:'新版本',body:'正式正文',sequence:5,status:'approved',lifecycle:'active',kind:'article',audience:'staff',tags:[],cover:null,blocks:[],assets:[],publishedRevision:1},revision:2,approval:{revision:2,reviewerId:'b',reviewerName:'Ivy',approvedAt:'2026-09-09T01:00:00Z'},canQueue:true,canPublish:false,canDirectPublish:false,history:[],historyMore:false};
test('publication acknowledgement must match the action, approved version, reviewer and published pointer',async()=>{
 const mod=await import('../src/review/publication-client.ts');assert.equal(typeof mod.sendPublication,'function');const original=globalThis.fetch;const input={action:'queue' as const,expectedSequence:5};
 const ack={documentId:'release-local',sequence:6,revision:2,action:'queue',status:'queued',publishedRevision:1,approvedBy:'b'};
 try{let sent='';globalThis.fetch=async(_url,options)=>{sent=String(options?.body);return Response.json(ack);};assert.deepEqual(await mod.sendPublication('release-local',input,2,'b',1),ack);assert.equal(sent,JSON.stringify(input));
 for(const [field,value] of Object.entries({documentId:'other',sequence:5,revision:1,action:'publish',status:'published',publishedRevision:2,approvedBy:'c'})){globalThis.fetch=async()=>Response.json({...ack,[field]:value});await assert.rejects(mod.sendPublication('release-local',input,2,'b',1),/INVALID_ACK/);}
 globalThis.fetch=async()=>Response.json({error:'INVALID_APPROVAL'},{status:409});await assert.rejects(mod.sendPublication('release-local',input,2,'b',1),mod.PublicationRejected);
 globalThis.fetch=async()=>Response.json({error:'REVIEW_UNAVAILABLE'},{status:503});await assert.rejects(mod.sendPublication('release-local',input,2,'b',1),/UNKNOWN_RESULT/);
 globalThis.fetch=async()=>Response.json({...ack,sequence:7,action:'publish',status:'published',publishedRevision:2});assert.equal((await mod.sendPublication('release-local',{action:'publish',expectedSequence:6},2,'b',1)).publishedRevision,2);
 const directInput={action:'direct_publish' as const,expectedSequence:8,englishQualityConfirmed:true as const},directAck={documentId:'release-local',sequence:9,revision:3,action:'direct_publish',status:'published',publishedRevision:3,approvedBy:'super'};
 globalThis.fetch=async(_url,options)=>{assert.equal(options?.body,JSON.stringify(directInput));return Response.json(directAck);};
 assert.deepEqual(await mod.sendPublication('release-local',directInput,3,null,2),directAck);
 for(const [field,value] of Object.entries({documentId:'other',sequence:8,revision:2,action:'publish',status:'queued',publishedRevision:2,approvedBy:''})){globalThis.fetch=async()=>Response.json({...directAck,[field]:value});await assert.rejects(mod.sendPublication('release-local',directInput,3,null,2),/INVALID_ACK/);}
 }finally{globalThis.fetch=original;}
});
test('publication reads reject stale content, malformed approval/history and impossible actionable states',async()=>{
 const mod=await import('../src/review/publication-client.ts');const original=globalThis.fetch;
 try{globalThis.fetch=async()=>Response.json(detail);assert.deepEqual(await mod.readPublication('release-local',5),detail);
 for(const patch of [{article:{...detail.article,sequence:4}},{approval:null},{approval:{...detail.approval,revision:1}},{canPublish:true},{canDirectPublish:true},{canDirectPublish:'yes'},{article:{...detail.article,lifecycle:'trashed'}},{revision:0},{history:[{}]},{historyMore:'yes'},{history:Array.from({length:21},()=>({sequence:5,revision:2,action:'queue',actorId:'a',actorName:'Alex',at:'2026-09-09T01:00:00Z'}))}]){globalThis.fetch=async()=>Response.json({...detail,...patch});await assert.rejects(mod.readPublication('release-local',5));}
 }finally{globalThis.fetch=original;}
});
