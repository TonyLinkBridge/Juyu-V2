import assert from 'node:assert/strict';
import {test} from 'node:test';
import {pdfHTML} from '../src/pdf/render.ts';
import {exportPDF} from '../src/server/pdf/export.ts';
const article={id:'a',title:'中文 <script>标题</script>',revision:1,publicationNumber:1,body:'# 步骤\n正文\n\n| 项目 | 说明 |\n| --- | --- |\n| 注册 | 核实身份 |'};
test('PDF markup escapes content, preserves tables and rejects external image sources',()=>{
 const html=pdfHTML({...article,revision:22});assert.match(html,/&lt;script&gt;标题/);assert.doesNotMatch(html,/<script>/);assert.match(html,/<thead>/);assert.match(html,/正式版本 1/);
 assert.throws(()=>pdfHTML(article,'https://outside.example/image'),/INVALID_IMAGE/);
});
test('PDF export rechecks access and current version after rendering before releasing bytes',async()=>{
 let calls=0;const snapshot={article,files:[]};let rendered=0;
 const dependencies={snapshot:async()=>{calls++;if(calls===2)throw new Error('NOT_FOUND');return snapshot;},asset:async()=>null,storage:()=>{throw new Error('not needed');},render:async()=>{rendered++;return Buffer.from('%PDF-1.7\nexample');}};
 const response=await exportPDF(new Request('http://local/api?revision=1'), 'a',1,dependencies);
 assert.equal(response.status,404);assert.equal(rendered,1);assert.equal(calls,2);assert.match(response.headers.get('cache-control')!,/no-store/);assert.doesNotMatch(await response.text(),/%PDF/);
});
test('PDF export never starts rendering inaccessible content and returns safe downloadable bytes',async()=>{
 let rendered=0;const deps={snapshot:async()=>({article,files:[]}),asset:async()=>null,storage:()=>{throw new Error('not needed');},render:async()=>{rendered++;return Buffer.from('%PDF-1.7\nexample');}};
 const denied=await exportPDF(new Request('http://local'), 'a',1,{...deps,snapshot:async()=>{throw new Error('FORBIDDEN');}});assert.equal(denied.status,403);assert.equal(rendered,0);
 const ok=await exportPDF(new Request('http://local?download=1'), 'a',1,deps);assert.equal(ok.status,200);assert.equal(ok.headers.get('content-type'),'application/pdf');assert.match(ok.headers.get('content-disposition')!,/^attachment;/);assert.match(await ok.text(),/^%PDF/);
 const mismatch=await exportPDF(new Request('http://local'), 'a',2,deps);assert.equal(mismatch.status,409);assert.equal(rendered,1);
});

test('print checks authorize the current revision without invoking storage or rendering',async()=>{
 const response=await exportPDF(new Request('http://local?check=1'),'a',1,{snapshot:async()=>({article,files:[]}),asset:async()=>{throw new Error('unexpected');},storage:()=>{throw new Error('unexpected');},render:async()=>{throw new Error('unexpected');}});
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{revision:1,coverId:null});
});
test('PDF cover reads are bounded and revoked cover permission discards completed bytes',async()=>{
 const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',coverArticle={...article,cover:{assetId:id,alt:'封面',position:50}};
 const asset={id,document_id:'a',filename:'cover.png',mime_type:'image/png',byte_size:3,bucket:'juyu-private',object_key:id};let checks=0,rendered=0;
 const deps={snapshot:async()=>({article:coverArticle,files:[]}),asset:async()=>{checks++;return checks===1?asset:null;},storage:()=>({read:async()=>new Response('abc',{headers:{'content-length':'3'}}),put:async()=>{}}),render:async()=>{rendered++;return Buffer.from('%PDF-1.7\nexample');}};
 const revoked=await exportPDF(new Request('http://local'),'a',1,deps);assert.equal(revoked.status,503);assert.deepEqual(await revoked.json(),{error:'IMAGE_UNAVAILABLE'});assert.equal(rendered,1);
 const oversized=await exportPDF(new Request('http://local'),'a',1,{...deps,asset:async()=>({...asset,byte_size:6*1024*1024})});assert.equal(oversized.status,413);assert.equal(rendered,1);
 const badLength=await exportPDF(new Request('http://local'),'a',1,{...deps,asset:async()=>asset,storage:()=>({read:async()=>new Response('toolong',{headers:{'content-length':'3'}}),put:async()=>{}})});assert.equal(badLength.status,503);assert.equal(rendered,1);
});

test('PDF feature disabled during generation refuses release and keeps disabled response private',async()=>{
 let calls=0;const response=await exportPDF(new Request('http://local?download=1'),'a',1,{snapshot:async()=>{if(++calls>1)throw new Error('FEATURE_DISABLED');return {article,files:[]};},asset:async()=>null,storage:()=>{throw new Error('not needed');},render:async()=>Buffer.from('%PDF-1.7\nexample')});assert.equal(response.status,403);assert.deepEqual(await response.json(),{error:'FEATURE_DISABLED'});assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(calls,2);
});
