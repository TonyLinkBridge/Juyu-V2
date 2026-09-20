'use client';
import {useId,useState} from 'react';
import type {ReferenceTableData} from '../../reference/model';
import {NativeReferenceTable} from './NativeReferenceTable';
import {filterReferenceRows} from '../../reference/filter';

export function ReferenceTable({table,number,locale='zh-CN'}:{table:ReferenceTableData;number:number;locale?:'zh-CN'|'en'}){
 const id=useId(),english=locale==='en';
 const [query,setQuery]=useState(''),[column,setColumn]=useState<number|null>(null),[page,setPage]=useState(1);
 const result=filterReferenceRows(table,query,column,page);
 const label=(zh:string,en:string)=>english?en:zh;
 const name=label(`速查表 ${number}`,`Reference table ${number}`);
 const columnName=(header:string,i:number)=>header||label(`第 ${i+1} 列`,`Column ${i+1}`);
 return <section className="reference-table" aria-label={name}><h3>{name}</h3>
  <div className="reference-filters"><label htmlFor={`${id}-query`}>{label('筛选表格','Search table')}<input id={`${id}-query`} value={query} placeholder={label('输入关键词，多个词用空格分开','Enter keywords separated by spaces')} aria-invalid={result.status==='invalid'||undefined} onChange={e=>{setQuery(e.target.value);setPage(1);}}/></label><label htmlFor={`${id}-column`}>{label('筛选范围','Search within')}<select id={`${id}-column`} value={column??'all'} onChange={e=>{setColumn(e.target.value==='all'?null:Number(e.target.value));setPage(1);}}><option value="all">{label('全部列','All columns')}</option>{table.headers.map((header,i)=><option key={i} value={i}>{columnName(header,i)}</option>)}</select></label><button type="button" onClick={()=>{setQuery('');setColumn(null);setPage(1);}}>{label('清除筛选','Clear filters')}</button></div>
  {result.status==='invalid'?<p role="alert">{label('筛选条件不正确，关键词最多 120 个字符。','Invalid filter. Use 120 characters or fewer.')}</p>:<><p role="status">{english?`${table.rows.length} rows · ${result.total} matches · Page ${result.page} of ${result.pages}`:`共 ${table.rows.length} 行 · 符合 ${result.total} 行 · 第 ${result.page} / ${result.pages} 页`}</p>{result.items.length?<div className="reader-scroll-region" role="region" tabIndex={0} aria-label={english?`${name}; scroll horizontally to view more columns`:`${name}，可横向滚动`}>{table.native?<NativeReferenceTable table={table} indices={result.items.map(row=>row.index)} number={number} locale={locale}/>:<table><caption className="sr-only">{label(`${name}，当前页筛选结果`,`${name}, filtered results`)}</caption><thead><tr><th scope="col">{label('原行号','Original row')}</th>{table.headers.map((header,i)=><th key={i} scope="col">{columnName(header,i)}</th>)}</tr></thead><tbody>{result.items.map(row=><tr key={row.index}><th scope="row">{row.index+1}</th>{row.cells.map((cell,i)=><td key={i}>{cell}</td>)}</tr>)}</tbody></table>}</div>:<p>{table.rows.length?label('没有符合条件的行，请更换关键词或清除筛选。','No matching rows. Try different keywords or clear the filters.'):label('这张表还没有数据行。','This table has no data rows yet.')}</p>}{result.pages>1&&<nav className="reference-row-pages" aria-label={label(`${name} 翻页`,`${name} pages`)}><button disabled={result.page===1} onClick={()=>setPage(result.page-1)}>{label('上一页','Previous')}</button><span>{result.page} / {result.pages}</span><button disabled={result.page===result.pages} onClick={()=>setPage(result.page+1)}>{label('下一页','Next')}</button></nav>}</>}
 </section>;
}
