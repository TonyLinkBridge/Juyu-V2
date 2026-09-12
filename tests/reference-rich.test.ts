import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeEditorBlocks} from '../src/editor/document.ts';
import {nativeReferenceTable,visibleReferenceCells} from '../src/reference/native.ts';
import {filterReferenceRows} from '../src/reference/filter.ts';
const text=(text:string)=>[{type:'text',text,styles:{}}];
const block=normalizeEditorBlocks([{id:'merged',type:'table',content:{type:'tableContent',columnWidths:[120,200,180],headerRows:2,headerCols:1,rows:[
 {cells:[{type:'tableCell',props:{rowspan:2},content:text('业务')},{type:'tableCell',props:{colspan:2},content:text('费用规则')}]},
 {cells:[text('价格'),text('条件')]},
 {cells:[{type:'tableCell',props:{rowspan:3,backgroundColor:'yellow'},content:text('域名')},text('100'),text('不可退款')]},
 {cells:[text('200'),text('可退款')]},
 {cells:[text('300'),text('需审核')]},
]}}])[0];
if(block.type!=='table')throw Error('fixture');

test('rich reference filters merged labels without shifting data or losing formats',()=>{
 const before=structuredClone(block);const table=nativeReferenceTable(block);
 assert.equal(filterReferenceRows(table,'域名',0).total,3);
 assert.deepEqual(table.headers,['业务','费用规则 / 价格','费用规则 / 条件']);
 assert.deepEqual(table.rows[1],['域名','200','可退款']);
 assert.deepEqual(table.native?.content,block.content);assert.deepEqual(block,before);
});
test('merged cells are clipped and repeated correctly on filtered or paginated rows',()=>{
 const full=visibleReferenceCells(block.content,[2,3,4]);assert.equal(full[0][0].rowSpan,3);assert.equal(full[1][0].column,1);
 const filtered=visibleReferenceCells(block.content,[3]);assert.equal(filtered[0][0].cell.content[0].type,'text');assert.equal(filtered[0][0].cell.props.backgroundColor,'yellow');assert.equal(filtered[0][0].rowSpan,1);
 const nonconsecutive=visibleReferenceCells(block.content,[2,4]);assert.equal(nonconsecutive[0][0].rowSpan,2);assert.equal(nonconsecutive[1][0].column,1);
 const header=visibleReferenceCells(block.content,[0,1]);assert.equal(header[0][0].rowSpan,2);assert.equal(header[0][1].colSpan,2);
});
test('single header spanning into data is clipped independently at the header boundary',()=>{
 const b=normalizeEditorBlocks([{id:'boundary',type:'table',content:{type:'tableContent',headerRows:1,rows:[{cells:[{type:'tableCell',props:{rowspan:2},content:text('共用标签')},text('规则')]},{cells:[text('说明')]}]}}])[0];
 if(b.type!=='table')throw Error('fixture');
 assert.equal(visibleReferenceCells(b.content,[0])[0][0].rowSpan,1);
 assert.equal(visibleReferenceCells(b.content,[1])[0][0].rowSpan,1);
 assert.deepEqual(nativeReferenceTable(b).rows,[['共用标签','说明']]);
});
