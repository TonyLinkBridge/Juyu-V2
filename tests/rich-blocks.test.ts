import assert from 'node:assert/strict';
import {test} from 'node:test';
import {normalizeBlocks} from '../src/media/model.ts';
import {pdfHTML} from '../src/pdf/render.ts';
const blocks=[{id:'hint',type:'hint',style:'warning',title:'先核实',body:'中文\n不可遗漏'}, {id:'code',type:'code',language:'html',code:'<script>alert(1)</script>\n  保留空格\n'}, {id:'tabs',type:'tabs',tabs:[{id:'one',title:'注册',body:'注册步骤'},{id:'two',title:'转入',body:'转入步骤'}]}];
test('T028 rich blocks preserve literal text, order and independent tab identity',()=>{
 assert.deepEqual(normalizeBlocks(blocks),blocks);const copy=normalizeBlocks(blocks);assert.notEqual(copy[2],blocks[2]);assert.deepEqual(normalizeBlocks([{...blocks[2],tabs:[{id:'one',title:'同名',body:'甲'},{id:'two',title:'同名',body:'乙'}]}])[0].type,'tabs');
});
test('T028 invalid styles, oversized content, nested payloads and duplicate tab IDs fail closed',()=>{
 for(const value of [[{...blocks[0],style:'script'}],[{...blocks[0],body:'字'.repeat(20001)}],[{...blocks[1],code:'x'.repeat(50001)}],[{...blocks[1],language:'<script>'}],[{...blocks[2],tabs:[]}],[{...blocks[2],tabs:[{id:'one',title:'A',body:'A'},{id:'one',title:'B',body:'B'}]}],[{...blocks[2],tabs:[{id:'one',title:'A',body:'A',blocks:[{type:'file',assetId:'forged'}]}]}]])assert.throws(()=>normalizeBlocks(value),/INVALID_MEDIA/);
});
test('T028 PDF includes every tab and literal escaped code, without interactive-only content',()=>{
 const html=pdfHTML({id:'rich',title:'内容',revision:1,body:'',blocks:normalizeBlocks(blocks)});assert.match(html,/先核实/);assert.match(html,/注册步骤/);assert.match(html,/转入步骤/);assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);assert.doesNotMatch(html,/<script>|role="tab"|hidden/);
});
