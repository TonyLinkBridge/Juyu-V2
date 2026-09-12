import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {encodeEditorBody} from '../../src/editor/document.ts';
import {pdfHTML} from '../../src/pdf/render.ts';
import {renderPDF} from '../../src/server/pdf/chromium.ts';
test('R20 real PDF preserves completed labels, colored linked text and unfinished descendants',async()=>{
 const text=(text:string,styles={})=>[{type:'text',text,styles}];
 const body=encodeEditorBody([
  {id:'intro',type:'paragraph',content:text('本地测试样例，不是真实业务资料。已完成项应有删除线，未完成项应保持原样。')},
  {id:'done',type:'checkListItem',props:{checked:true},content:[...text('已核对客户资料 ',{bold:true,textColor:'red',backgroundColor:'yellow'}),{type:'link',href:'https://example.com/rules',content:text('查看核对规则',{underline:true})}],children:[{id:'pending-child',type:'checkListItem',props:{checked:false},content:text('子项目：等待提交审核（没有删除线）')}]},
  {id:'pending',type:'checkListItem',props:{checked:false},content:text('尚未完成：等待主管确认',{textColor:'blue'})},
  {id:'long',type:'checkListItem',props:{checked:true},content:text('已完成的长说明：'+ '已经核实资料并记录处理结果，'.repeat(9))},
  {id:'explicit',type:'checkListItem',props:{checked:false},content:[...text('未完成项中的手动格式：'),...text('手动删除线',{strike:true,italic:true}),...text(' / '),...text('保留代码',{code:true})]},
 ]);
 const html=pdfHTML({id:'checklist-test',title:'勾选项格式核对',revision:1,body});
 assert.equal(html.match(/text-decoration:line-through/g)?.length,2);
 const bytes=await renderPDF(html);assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
 await mkdir('output/pdf',{recursive:true});await writeFile('output/pdf/T063-R20-checklist.pdf',bytes);
});
