'use client';
import {useMemo,useState} from 'react';
import type {MediaBlock} from '../../media/model';
import {useReaderLocale} from './ArticleReferenceContext';

type TableBlock=Extract<MediaBlock,{type:'table'}>;
const fold=(value:string)=>value.normalize('NFKC').toLocaleLowerCase();

export function TableExplorer({block}:{block:TableBlock}){
 const english=useReaderLocale()==='en';
 const [query,setQuery]=useState(''),[filters,setFilters]=useState<Record<number,string>>({}),[sort,setSort]=useState<{column:number;direction:1|-1}|null>(null);
 const view=block.view??'grid',searchable=block.searchable??(view==='grid'&&block.rows.length>=8);
 const options=useMemo(()=>block.headers.map((_,column)=>[...new Set(block.rows.map(row=>row[column]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,english?'en':'zh-CN')).slice(0,100)),[block.headers,block.rows,english]);
 const normalized=fold(query.trim());
 const rows=useMemo(()=>block.rows.map((cells,index)=>({cells,index})).sort((a,b)=>sort?sort.direction*a.cells[sort.column].localeCompare(b.cells[sort.column],english?'en':'zh-CN')||a.index-b.index:a.index-b.index),[block.rows,sort,english]);
 const visible=(cells:string[])=>{if(normalized&&!cells.some(cell=>fold(cell).includes(normalized)))return false;return Object.entries(filters).every(([column,value])=>!value||cells[Number(column)]===value);};
 const shownRows=rows.filter(row=>visible(row.cells));
 const count=shownRows.length;
 function sortBy(column:number){setSort(current=>current?.column!==column?{column,direction:1}:current.direction===1?{column,direction:-1}:null);}
 const columnName=(header:string,column:number)=>header||(english?`Column ${column+1}`:`第 ${column+1} 列`);
 return <section className="reader-data-table" data-view={view} aria-label={english?'Data table':'资料表格'}>
  {searchable&&<div className="reader-data-table-tools"><label>{english?'Search table':'查找表格内容'}<input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder={english?'Search rows':'输入关键词'}/></label><span role="status">{english?`Showing ${count} of ${block.rows.length} rows`:`显示 ${count} / ${block.rows.length} 行`}</span></div>}
  {searchable&&block.rows.length>0&&<div className="reader-data-table-filters">{block.headers.map((header,column)=>options[column].length>1?<label key={column}>{columnName(header,column)}<select aria-label={english?`Filter ${columnName(header,column)}`:`筛选：${columnName(header,column)}`} value={filters[column]??''} onChange={event=>setFilters(current=>({...current,[column]:event.target.value}))}><option value="">{english?'All':'全部'}</option>{options[column].map(value=><option key={value} value={value}>{value}</option>)}</select></label>:null)}</div>}
  <div className={`reader-scroll-region reader-data-table-grid${block.stickyHeader?' sticky-header':''}${block.stickyFirstColumn?' sticky-first-column':''}`} role="region" tabIndex={0} aria-label={english?'Data table; scroll horizontally to view more columns':'资料表格，可横向滚动'}><table><thead><tr>{block.headers.map((header,column)=><th scope="col" key={column}><button type="button" aria-label={english?`Sort by ${columnName(header,column)}`:`排序：${columnName(header,column)}`} aria-pressed={sort?.column===column} onClick={()=>sortBy(column)}>{columnName(header,column)}{sort?.column===column?sort.direction===1?' ↑':' ↓':''}</button></th>)}</tr></thead><tbody>{shownRows.map(({cells,index})=><tr key={index}>{cells.map((cell,column)=><td key={column}>{cell}</td>)}</tr>)}</tbody></table></div>
  <div className="reader-data-table-cards" aria-label={english?'Table cards':'表格卡片'}>{shownRows.map(({cells,index})=><article key={index}><dl>{cells.map((cell,column)=><div key={column}><dt>{columnName(block.headers[column],column)}</dt><dd>{cell||'—'}</dd></div>)}</dl></article>)}</div>
  <table className="reader-data-table-print"><thead><tr>{block.headers.map((header,column)=><th key={column}>{header}</th>)}</tr></thead><tbody>{block.rows.map((cells,index)=><tr key={index}>{cells.map((cell,column)=><td key={column}>{cell}</td>)}</tr>)}</tbody></table>
  {count===0&&block.rows.length>0&&<p className="reader-data-table-empty">{english?'No matching rows. Clear your search or filters to see everything.':'没有符合条件的内容。清除搜索或筛选后可查看全部。'}</p>}
 </section>;
}
