import assert from 'node:assert/strict';
import test from 'node:test';
import {applyTableBorderPreset,applyTableVerticalAlignment,normalizeTable,tableBorderData,tableCellAnchors,tableCellVerticalAlignStyle,tableVerticalAlignData} from '../src/editor/table.ts';

const text=(value:string)=>[{type:'text',text:value,styles:{}}];
const table=normalizeTable({type:'tableContent',rows:[
 {cells:[text('A'),text('B')]},
 {cells:[text('C'),text('D')]},
]});
const red={width:2 as const,color:'#cc2233'};

test('table geometry keeps logical coordinates stable for merged cells',()=>{
 const merged=normalizeTable({type:'tableContent',rows:[
  {cells:[{type:'tableCell',props:{rowspan:2},content:text('A')},text('B')]},
  {cells:[text('C')]},
 ]});
 assert.deepEqual(tableCellAnchors(merged).map(({row,column,rowspan,colspan})=>({row,column,rowspan,colspan})),[
  {row:0,column:0,rowspan:2,colspan:1},
  {row:0,column:1,rowspan:1,colspan:1},
  {row:1,column:1,rowspan:1,colspan:1},
 ]);
});

test('all borders synchronize both sides of shared cell edges',()=>{
 const value=applyTableBorderPreset('',table,[{row:0,column:0},{row:0,column:1}],'all',red);
 const data=tableBorderData(value);
 assert.deepEqual(data['0:0'].right,red);
 assert.deepEqual(data['0:1'].left,red);
 assert.deepEqual(data['0:0'].top,red);
 assert.deepEqual(data['0:1'].bottom,red);
});

test('outside and inside presets affect only their requested boundaries',()=>{
 const selection=tableCellAnchors(table).map(({row,column})=>({row,column}));
 const outside=tableBorderData(applyTableBorderPreset('',table,selection,'outside',red));
 assert.deepEqual(outside['0:0'].top,red);assert.deepEqual(outside['0:0'].left,red);
 assert.equal(outside['0:0'].right,undefined);assert.equal(outside['0:0'].bottom,undefined);
 const inside=tableBorderData(applyTableBorderPreset('',table,selection,'inside',red));
 assert.deepEqual(inside['0:0'].right,red);assert.deepEqual(inside['0:1'].left,red);
 assert.deepEqual(inside['0:0'].bottom,red);assert.deepEqual(inside['1:0'].top,red);
 assert.equal(inside['0:0'].top,undefined);assert.equal(inside['0:0'].left,undefined);
});

test('no border hides selected edges and matching neighbor edges',()=>{
 const initial=applyTableBorderPreset('',table,tableCellAnchors(table).map(({row,column})=>({row,column})),'all',red);
 const cleared=tableBorderData(applyTableBorderPreset(initial,table,[{row:0,column:0}],'none',red));
 assert.equal(cleared['0:0'].right,null);assert.equal(cleared['0:1'].left,null);
 assert.equal(cleared['0:0'].bottom,null);assert.equal(cleared['1:0'].top,null);
});

test('vertical alignment follows the logical anchor of a merged table cell',()=>{
 const merged=normalizeTable({type:'tableContent',rows:[
  {cells:[{type:'tableCell',props:{rowspan:2,colspan:2},content:text('合并')},text('右侧')]},
  {cells:[text('右下')]},
 ]});
 const value=applyTableVerticalAlignment('',merged,[{row:0,column:0}],'middle');
 assert.deepEqual(tableVerticalAlignData(value),{'0:0':'middle'});
 assert.deepEqual(tableCellVerticalAlignStyle(value,0,0),{verticalAlign:'middle'});
 assert.deepEqual(tableCellVerticalAlignStyle(value,0,2),{verticalAlign:'top'});
});

test('vertical alignment applies to every selected cell and can return to the top',()=>{
 const middle=applyTableVerticalAlignment('',table,[{row:0,column:0},{row:0,column:1}],'middle');
 assert.deepEqual(tableVerticalAlignData(middle),{'0:0':'middle','0:1':'middle'});
 const top=applyTableVerticalAlignment(middle,table,[{row:0,column:0}],'top');
 assert.deepEqual(tableVerticalAlignData(top),{'0:1':'middle'});
 assert.deepEqual(tableCellVerticalAlignStyle(top,0,0),{verticalAlign:'top'});
});
