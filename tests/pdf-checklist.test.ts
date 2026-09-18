import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeEditorBlocks} from '../src/editor/document.ts';
import {printEditor} from '../src/editor/print.ts';
const text=(text:string,styles={})=>[{type:'text',text,styles}];
test('R20 completed checklist strikes its formatted label and link, not its unchecked child',()=>{
 const blocks=normalizeEditorBlocks([{id:'done',type:'checkListItem',props:{checked:true},content:[...text('已核对',{textColor:'red',backgroundColor:'yellow',bold:true}),{type:'link',href:'https://example.com/rules',content:text('核对说明',{underline:true})}],children:[{id:'child',type:'checkListItem',props:{checked:false},content:text('待提交')}]}]);
 const html=printEditor(blocks,()=>{throw Error('NO_MEDIA');});
 assert.match(html,/☑ <span style="text-decoration:line-through">/);
 assert.match(html,/color:#e03e3e;background-color:#fbf3db/);assert.match(html,/<strong>已核对<\/strong>/);
 assert.match(html,/href="https:\/\/example.com\/rules"/);assert.match(html,/<u>核对说明<\/u><\/a><\/span><\/p>/);
 assert.match(html,/☐ 待提交<\/p>/);assert.equal(html.match(/text-decoration:line-through/g)?.length,1);
});
test('R20 unchecked items retain explicit marks without acquiring completion strike',()=>{
 const blocks=normalizeEditorBlocks([{id:'pending',type:'checkListItem',props:{checked:false},content:[...text('待处理'),...text('原有删除线',{strike:true})]}]);
 const html=printEditor(blocks,()=>{throw Error('NO_MEDIA');});
 assert.match(html,/☐ 待处理<s>原有删除线<\/s>/);assert.doesNotMatch(html,/text-decoration:line-through/);
});
test('strong red background exports with white text for legibility',()=>{
 const blocks=normalizeEditorBlocks([{id:'alert',type:'paragraph',content:text('不可执行',{backgroundColor:'red'})}]);
 const html=printEditor(blocks,()=>{throw Error('NO_MEDIA');});
 assert.match(html,/color:#fff;background-color:#ae2832/);
});
