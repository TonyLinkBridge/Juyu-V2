import {parseSearchQuery,foldSearchText} from '../reader/search.ts';
import type {ReferenceTableData} from './model.ts';
/** Local convenience over an already delivered authorized table, never an access check. */
export function filterReferenceRows(table:ReferenceTableData,raw:string,column:number|null=null,requestedPage=1){
 const parsed=parseSearchQuery(raw);const invalid=parsed.status==='invalid'||(column!==null&&(!Number.isInteger(column)||column<0||column>=table.headers.length))||!Number.isSafeInteger(requestedPage)||requestedPage<1;
 const words=foldSearchText(parsed.query).split(' ').filter(Boolean);
 const matches=invalid?[]:table.rows.map((cells,index)=>({cells,index})).filter(row=>{const text=foldSearchText(column===null?row.cells.join(' '):row.cells[column]??'');return words.every(word=>text.includes(word));});
 const pages=Math.max(1,Math.ceil(matches.length/20)),page=Math.min(invalid?1:requestedPage,pages);
 return {status:invalid?'invalid' as const:parsed.status,items:matches.slice((page-1)*20,page*20),total:matches.length,page,pages};
}
