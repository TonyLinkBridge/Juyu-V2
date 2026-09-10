import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {renderPDF} from '../../src/server/pdf/chromium.ts';
import {pdfHTML} from '../../src/pdf/render.ts';
import {exportPDF} from '../../src/server/pdf/export.ts';
const assetId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
test('real server PDF exports Chinese, private cover and 140 table rows without external requests',async()=>{
 const image=await readFile('tests/fixtures/article-cover.png');
 const article={id:'pdf-local-verification',title:'运营资料导出 · 本地示例',revision:1,cover:{assetId,alt:'本地合成封面',position:50},tags:['本地验收'],body:'# 使用说明\n这是经过权限检查的正式文章示例，不是真实业务资料。\n\n![外部图片不会被请求](https://outside.invalid/track)\n\n## 费用参考\n| 序号 | 项目 | 操作说明 |\n| --- | --- | --- |\n'+Array.from({length:140},(_,i)=>`| ${i+1} | 示例费用 ${i+1} | 注册、续费、转入前请核对规则。 |`).join('\n')+'\n\n## 核对完成\n表格最后一行应为 140；此处是正文结尾。'};
 const snapshot={article,files:[]};const asset={id:assetId,document_id:article.id,filename:'cover.png',mime_type:'image/png',byte_size:image.length,bucket:'juyu-private',object_key:assetId};
 let reads=0,checks=0;const response=await exportPDF(new Request('http://local?download=1'),article.id,1,{snapshot:async()=>{checks++;return snapshot;},asset:async()=>asset,storage:()=>({read:async()=>{reads++;return new Response(image,{headers:{'content-length':String(image.length)}});},put:async()=>{throw new Error('NO_WRITES');}}),render:renderPDF});
 assert.equal(response.status,200,await response.clone().text());assert.equal(checks,2);assert.equal(reads,1);
 const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert.ok(bytes.length>10000);
 await mkdir('output/pdf',{recursive:true});await writeFile('output/pdf/T026-local-verification.pdf',bytes);
});
test('real renderer rejects undecodable image bytes and can recover for a later job',async()=>{
 const article={id:'bad',title:'图片检查',revision:1,body:'正文'};
 await assert.rejects(renderPDF(pdfHTML(article,'data:image/png;base64,AAAA')));
 const bytes=await renderPDF(pdfHTML(article));assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
});

test('T027 real PDF includes inline private image, structured cells and file/video descriptions',async()=>{
 const image=await readFile('tests/fixtures/article-cover.png');const videoId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';const fileId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 const article={id:'media-pdf',title:'媒体导出 · 本地示例',revision:1,body:'此页为本地验收示例。',blocks:[{id:'image',type:'image' as const,assetId,caption:'正文图片说明',alt:'本地截图'},{id:'table',type:'table' as const,headers:['项目','处理步骤'],rows:[['注册','核对费用\n确认授权'],['转入','检查状态']]},{id:'video',type:'video' as const,assetId:videoId,caption:'操作影片',alt:''},{id:'file',type:'file' as const,assetId:fileId,caption:'参考文件',alt:''}]};
 let checks=0,reads=0;const response=await exportPDF(new Request('http://local?download=1'),article.id,1,{snapshot:async()=>({article,files:[]}),asset:async id=>{checks++;return {id,document_id:article.id,filename:'fixture',mime_type:id===assetId?'image/png':id===videoId?'video/webm':'text/plain',byte_size:id===assetId?image.length:20,bucket:'juyu-private',object_key:id};},storage:()=>({read:async()=>{reads++;return new Response(image,{headers:{'content-length':String(image.length)}});},put:async()=>{throw new Error('NO_WRITES');}}),render:renderPDF});
 assert.equal(response.status,200,await response.clone().text());assert.equal(checks,6);assert.equal(reads,1);await mkdir('output/pdf',{recursive:true});await writeFile('output/pdf/T027-media-verification.pdf',Buffer.from(await response.arrayBuffer()));
});
test('T028 real PDF prints hint literal code and all tab panels without storage access',async()=>{
 const article={id:'rich-pdf',title:'提示代码标签 · 本地示例',revision:1,body:'这份样例用于本地排版验证。',blocks:[{id:'hint',type:'hint' as const,style:'warning' as const,title:'操作前确认',body:'先核实身份，再确认权限。'},{id:'code',type:'code' as const,language:'html',code:'<script>literal only</script>\n  保留缩进\n'+Array.from({length:25},(_,i)=>`第 ${i+1} 行：示例内容`).join('\n')},{id:'tabs',type:'tabs' as const,tabs:[{id:'first',title:'注册流程',body:'第一个标签完整内容。'},{id:'second',title:'转入流程',body:'第二个标签也必须导出。'}]}]};
 const response=await exportPDF(new Request('http://local'),article.id,1,{snapshot:async()=>({article,files:[]}),asset:async()=>{throw new Error('UNEXPECTED_ASSET');},storage:()=>{throw new Error('UNEXPECTED_STORAGE');},render:renderPDF});assert.equal(response.status,200,await response.clone().text());await mkdir('output/pdf',{recursive:true});await writeFile('output/pdf/T028-rich-verification.pdf',Buffer.from(await response.arrayBuffer()));
});
