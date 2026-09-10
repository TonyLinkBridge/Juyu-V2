import {test} from 'node:test';
import assert from 'node:assert/strict';
import {diagramSVG,svgImage} from '../../src/server/science/render.ts';
import {exportPDF} from '../../src/server/pdf/export.ts';
import {renderPDF} from '../../src/server/pdf/chromium.ts';
import {writeFile,mkdir} from 'node:fs/promises';
test('T029 actual offline Mermaid render accepts Chinese flowchart and rejects unsafe/malformed source',async()=>{
 const svg=await diagramSVG('flowchart TD\n A[提交草稿] --> B{二审通过?}\n B -->|是| C[发布]\n B -->|否| D[修改]');assert.match(svg,/<svg/);assert.match(svg,/提交草稿/);assert.doesNotMatch(svg,/<foreignObject|<script|onclick/);await mkdir('output/verification',{recursive:true});await writeFile('output/verification/science-diagram.svg',svg);
 await assert.rejects(diagramSVG('flowchart TD\n A[missing'),/Parse|parse|Syntax|syntax/);await assert.rejects(diagramSVG('flowchart TD\n click A "https://outside.test"'));
});
test('T029 PDF contains rendered formula and actual flowchart with all text',async()=>{
 const article={id:'science',title:'公式与流程图 · 本地示例',revision:1,body:'**核对重点**\n\n- 确认身份\n- 检查权限',blocks:[{id:'formula',type:'math' as const,source:'\\frac{a+b}{2}=x^2',caption:'公式说明'},{id:'flow',type:'diagram' as const,source:'flowchart LR\n A[提交] --> B[二审] --> C[发布]',caption:'审批流程图'}]};
 const response=await exportPDF(new Request('http://local'),article.id,1,{snapshot:async()=>({article,files:[]}),asset:async()=>{throw new Error('NO_ASSETS');},storage:()=>{throw new Error('NO_STORAGE');},render:renderPDF});assert.equal(response.status,200,await response.clone().text());await mkdir('output/pdf',{recursive:true});await writeFile('output/pdf/T029-science-verification.pdf',Buffer.from(await response.arrayBuffer()));assert.match(svgImage('<svg/>'),/^data:image\/svg\+xml;base64,/);
});
test('T029 two simultaneous diagram renders both complete',async()=>{
 const results=await Promise.all([diagramSVG('flowchart TD\nA[第一张]-->B[完成]'),diagramSVG('flowchart TD\nC[第二张]-->D[完成]')]);assert.equal(results.length,2);assert.match(results[1],/第二张/);
});
