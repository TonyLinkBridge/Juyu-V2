import type {EditorBlock} from '../editor/document.ts';
import {inlineText} from '../editor/inline.ts';
import type {Cell,TableContent} from '../editor/table.ts';
import type {ReferenceTableData} from './model.ts';

type Slot={cell:Cell;column:number;row:number};
// Input is normalized by the same parser as the employee article reader.
function grid(content:TableContent):Slot[][]{
 const slots:Slot[][]=content.rows.map(()=>[]);
 content.rows.forEach((row,y)=>{
  let x=0;
  for(const cell of row.cells){
   while(slots[y][x])x++;
   const slot={cell,column:x,row:y};
   for(let dy=y;dy<y+(cell.props.rowspan??1);dy++)for(let dx=x;dx<x+(cell.props.colspan??1);dx++)slots[dy][dx]=slot;
   x+=cell.props.colspan??1;
  }
 });
 return slots;
}
export function nativeReferenceTable(block:Extract<EditorBlock,{type:'table'}>):ReferenceTableData{
 const content=block.content,slots=grid(content),headerRows=content.headerRows??0;
 const headers=content.columnWidths.map((_,x)=>headerRows?[...new Set(slots.slice(0,headerRows).map(row=>inlineText(row[x].cell.content)).filter(Boolean))].join(' / '):`列 ${x+1}`);
 return {id:block.id,headers,rows:slots.slice(headerRows).map(row=>row.map(slot=>inlineText(slot.cell.content))),native:{props:block.props,content}};
}
export type VisibleReferenceCell={cell:Cell;column:number;rowSpan:number;colSpan:number;header:boolean};
/** Clip spans to the visible rows. A filtered/page-start continuation repeats its source label. */
export function visibleReferenceCells(content:TableContent,rowIndices:number[]):VisibleReferenceCell[][]{
 const slots=grid(content);
 return rowIndices.map((row,index)=>{
  const cells:VisibleReferenceCell[]=[];
  for(let column=0;column<content.columnWidths.length;){
   const slot=slots[row][column],colSpan=slot.cell.props.colspan??1;
   if(index===0||slots[rowIndices[index-1]][column]!==slot){
    let rowSpan=1;
    while(index+rowSpan<rowIndices.length&&slots[rowIndices[index+rowSpan]][column]===slot)rowSpan++;
    cells.push({cell:slot.cell,column,rowSpan,colSpan,header:row<(content.headerRows??0)||column<(content.headerCols??0)});
   }
   column+=colSpan;
  }
  return cells;
 });
}
