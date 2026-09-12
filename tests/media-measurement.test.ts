import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deliverAsset} from '../src/server/storage/delivery.ts';
import {exportPDF} from '../src/server/pdf/export.ts';
import {measured} from '../src/server/performance.ts';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const asset={id,document_id:'doc',filename:'PRIVATE.png',mime_type:'image/png',byte_size:1,bucket:'juyu-private',object_key:id};
const store={read:async()=>new Response(new Uint8Array([1]),{headers:{'content-length':'1'}}),put:async()=>{throw new Error('UNEXPECTED');}};
test('R24 asset and PDF summaries count initial checks and release rechecks without changing protection',async t=>{
 const old=process.env.JUYU_PERFORMANCE_LOGGING;const logs:string[]=[];t.mock.method(console,'info',(s:string)=>logs.push(s));process.env.JUYU_PERFORMANCE_LOGGING='true';
 try{
 const auth=()=>measured('identity.verify',async()=>asset);
 assert.equal((await deliverAsset(new Request('http://local'),id,auth,store)).status,200);
 let row=JSON.parse(logs.pop()!);assert.equal(row.stages['identity.verify'].count,2);assert.equal(row.stages['asset.authorize'].count,1);assert.equal(row.stages['asset.recheck'].count,1);assert.equal(row.stages['storage.headers'].count,1);
 const snapshot={article:{id:'doc',revision:1,title:'PRIVATE',body:'text',cover:{assetId:id,alt:'',position:50}},files:[]};
 const deps={snapshot:()=>measured('identity.verify',async()=>snapshot),asset:auth,storage:()=>store,render:async()=>Buffer.from('%PDF-fixture')};
 assert.equal((await exportPDF(new Request('http://local'), 'doc',1,deps)).status,200);row=JSON.parse(logs.pop()!);assert.equal(row.stages['identity.verify'].count,4);assert.equal(row.stages['pdf.render'].count,1);assert.equal(row.stages['pdf.asset'].count,1);assert.equal(row.stages['pdf.asset-recheck'].count,1);assert.equal(row.stages['storage.body'].count,1);
 let checks=0;assert.equal((await deliverAsset(new Request('http://local'),id,async()=>++checks===1?asset:null,store)).status,404);row=JSON.parse(logs.pop()!);assert.equal(row.status,404);assert.equal(row.stages['asset.recheck'].count,1);
 assert.equal((await exportPDF(new Request('http://local'),'doc',1,{...deps,snapshot:async()=>{throw new Error('FORBIDDEN: PRIVATE');}})).status,403);row=JSON.parse(logs.pop()!);assert.equal(row.stages['pdf.snapshot'].failures,1);assert.ok(!JSON.stringify(row).includes('PRIVATE'));assert.equal(row.stages['pdf.render'],undefined);
 }finally{if(old===undefined)delete process.env.JUYU_PERFORMANCE_LOGGING;else process.env.JUYU_PERFORMANCE_LOGGING=old;}
});
