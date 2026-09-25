import type {ReferenceTableData} from '../../reference/model';
import {visibleReferenceCells,type VisibleReferenceCell} from '../../reference/native';
import {StructuredInline,structuredStyle} from '../reader-support/StructuredInline';

function cells(items:VisibleReferenceCell[],locale:'zh-CN'|'en'){
 return items.map(({cell,column,rowSpan,colSpan,header})=>{
  const Tag=header?'th':'td';
  return <Tag key={column} rowSpan={rowSpan} colSpan={colSpan} style={structuredStyle(cell.props)}><StructuredInline content={cell.content} locale={locale}/></Tag>;
 });
}
export function NativeReferenceTable({table,indices,number,locale='zh-CN'}:{table:ReferenceTableData;indices:number[];number:number;locale?:'zh-CN'|'en'}){
 const native=table.native!;const content=native.content,headerRows=content.headerRows??0;
 const headers=visibleReferenceCells(content,Array.from({length:headerRows},(_,i)=>i));
 const rows=visibleReferenceCells(content,indices.map(index=>index+headerRows));
 return <table className="reference-rich-table" style={structuredStyle(native.props)}>
  <caption className="sr-only">{locale==='en'?`Reference table ${number}, filtered results`:`速查表 ${number}，当前页筛选结果`}</caption>
  <colgroup><col/>{content.columnWidths.map((width,i)=><col key={i} style={{width}}/>)}</colgroup>
  <thead>{headerRows?headers.map((items,i)=><tr key={i}>{i===0&&<th scope="col" rowSpan={headerRows}>{locale==='en'?'Original row':'原行号'}</th>}{cells(items,locale)}</tr>):<tr><th scope="col">{locale==='en'?'Original row':'原行号'}</th>{table.headers.map((header,i)=><th scope="col" key={i}>{header}</th>)}</tr>}</thead>
  <tbody>{rows.map((items,i)=><tr key={indices[i]}><th scope="row">{indices[i]+1}</th>{cells(items,locale)}</tr>)}</tbody>
 </table>;
}
