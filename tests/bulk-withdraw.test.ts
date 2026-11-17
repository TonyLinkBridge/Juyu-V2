import test from 'node:test';
import assert from 'node:assert/strict';
import {bulkWithdrawInput} from '../src/review/bulk-withdraw.ts';
import {sendBulkWithdraw,BulkWithdrawRejected,readWithdrawWorkspace} from '../src/review/bulk-withdraw-client.ts';
const item={documentId:'doc-1',expectedSequence:4,revision:2,publishedRevision:1};
const input={items:[item]};
const ack={items:[{documentId:'doc-1',sequence:5,revision:2,action:'withdraw' as const,status:'draft' as const,previousReviewerId:'reviewer',reviewerId:null,publishedRevision:1}]};
test('batch accepts only one to thirty distinct exact snapshots and rejects forged extras',()=>{
 assert.deepEqual(bulkWithdrawInput(input),input);
 for(const value of [null,[],{}, {items:[]},{items:[item,item]},{items:Array.from({length:31},(_,i)=>({...item,documentId:`doc-${i}`}))},{...input,actorId:'admin'},{items:[{...item,reason:'test'}]},{items:[{...item,expectedSequence:'4'}]},{items:[{...item,revision:0}]},{items:[{...item,publishedRevision:0}]},{items:[{...item,documentId:' doc-1'}]},{items:[{...item,expectedSequence:2147483647}]},{items:[{...item,documentId:'a\0b'}]}])assert.throws(()=>bulkWithdrawInput(value),/INVALID_INPUT/);
});
test('batch client validates every exact acknowledgement and treats malformed or lost results as uncertain',async()=>{
 const original=globalThis.fetch;let sent='';try{
 globalThis.fetch=async(_url,options)=>{sent=String(options?.body);return Response.json(ack);};assert.deepEqual(await sendBulkWithdraw(input),ack);assert.equal(sent,JSON.stringify(input));
 for(const patch of [{documentId:'wrong'},{sequence:7},{revision:3},{action:'reassign'},{status:'in_review'},{previousReviewerId:null},{reviewerId:'someone'},{publishedRevision:2}]){globalThis.fetch=async()=>Response.json({items:[{...ack.items[0],...patch}]});await assert.rejects(sendBulkWithdraw(input),/UNKNOWN_RESULT/);}
 for(const value of [{items:[]},{items:[...ack.items,...ack.items]},null]){globalThis.fetch=async()=>Response.json(value);await assert.rejects(sendBulkWithdraw(input),/UNKNOWN_RESULT/);}
 globalThis.fetch=async()=>Response.json({error:'CONFLICT'},{status:409});await assert.rejects(sendBulkWithdraw(input),BulkWithdrawRejected);
 globalThis.fetch=async()=>Response.json({error:'PRIVATE'},{status:503});await assert.rejects(sendBulkWithdraw(input),/UNKNOWN_RESULT/);
 }finally{globalThis.fetch=original;}
});

test('post-withdraw workspace reload rejects a stale row or mismatched query instead of showing old actions',async()=>{
 const original=globalThis.fetch;const query={q:'',scope:'all' as const,kind:'all' as const,status:'all' as const,view:'list' as const,page:1};
 const row={id:'doc-1',title:'测试',kind:'qa',status:'draft',sequence:5,revision:2,publishedRevision:1,updatedAt:'2026-11-17T00:00:00Z',author:'A',editor:'A',submitter:null,reviewer:null};
 const data={query,items:[row],counts:{draft:1,in_review:0,changes_requested:0,approved:0,queued:0,published:0},total:1,page:1,pages:1};
 try{globalThis.fetch=async()=>Response.json(data);assert.deepEqual(await readWithdrawWorkspace(query,ack.items),data);
 for(const value of [{...data,items:[{...row,sequence:4,status:'in_review'}]},{...data,query:{...query,scope:'review'}},{...data,total:2},{...data,items:[row,row]}]){globalThis.fetch=async()=>Response.json(value);await assert.rejects(readWithdrawWorkspace(query,ack.items),/READ_FAILED/);}
 }finally{globalThis.fetch=original;}
});
