import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {encodeEditorBody,decodeEditorBody,editorMedia} from '../../src/editor/document.ts';
import {renderPDF} from '../../src/server/pdf/chromium.ts';
import {exportPDF} from '../../src/server/pdf/export.ts';
const assetId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
test('T031 real PDF exports interleaved text, private image, nested list, table and marked heading in original order',async()=>{
 const image=await readFile('tests/fixtures/article-cover.png');
 const inline=(text:string,styles={})=>[{type:'text',text,styles}];
 const custom=(payload:{id:string;type:string;[key:string]:unknown})=>({id:payload.id,type:'juyu',props:{payload:JSON.stringify(payload)},children:[]});
 const body=encodeEditorBody([
  {id:'opening',type:'heading',props:{level:1},content:inline('开始 · START',{bold:true}),children:[]},
  {id:'before',type:'paragraph',props:{},content:inline('图片前正文：顺序必须保持。',{italic:true,underline:true}),children:[]},
  custom({id:'picture',type:'image',assetId,caption:'正文中间图片 · IMAGE',alt:'本地示例图片'}),
  {id:'after',type:'paragraph',props:{textAlignment:'center'},content:inline('图片后正文 · AFTER'),children:[]},
  {id:'parent',type:'numberedListItem',props:{start:3},content:inline('第三步，包含子项目'),children:[
   {id:'child',type:'bulletListItem',props:{},content:inline('缩进项目 · NESTED',{code:true}),children:[]},
   custom({id:'table',type:'table',headers:['项目','说明'],rows:[['顺序','保留嵌套位置 · TABLE']]})
  ]},
  custom({id:'hint',type:'hint',style:'warning',title:'提示位置 · HINT',body:'本地验收样例，不涉及真实资料。'}),
  {id:'end',type:'heading',props:{level:2},content:inline('结束 · END',{strike:true}),children:[]},
 ]);
 const article={id:'editor-pdf',title:'结构化正文 · 本地示例',revision:1,body,blocks:editorMedia(decodeEditorBody(body)!)};
 let checks=0,reads=0;
 const response=await exportPDF(new Request('http://local?download=1'),article.id,1,{snapshot:async()=>({article,files:[]}),asset:async()=>{checks++;return {id:assetId,document_id:article.id,filename:'fixture.png',mime_type:'image/png',byte_size:image.length,bucket:'juyu-private',object_key:assetId};},storage:()=>({read:async()=>{reads++;return new Response(image,{headers:{'content-length':String(image.length)}});},put:async()=>{throw new Error('NO_WRITES');}}),render:async html=>{
  const positions=['START','IMAGE','AFTER','NESTED','TABLE','HINT','END'].map(token=>html.indexOf(token));assert.ok(positions.every((position,index)=>position>=0&&(index===0||position>positions[index-1])));assert.equal(html.match(/正文中间图片 · IMAGE/g)?.length,1);return renderPDF(html);
 }});
 assert.equal(response.status,200,await response.clone().text());assert.equal(checks,2);assert.equal(reads,1);
 const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
 await mkdir('output/pdf',{recursive:true});await writeFile('output/pdf/T031-editor-verification.pdf',bytes);
});
