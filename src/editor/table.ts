import {invalid,record,keys,color,normalizeInline,inlineText,type EditorInline} from './inline.ts';
export type Alignment='left'|'center'|'right'|'justify';
export type Cell={type:'tableCell';props:{textColor:string;backgroundColor:string;textAlignment:Alignment;colspan?:number;rowspan?:number};content:EditorInline[]};
export type TableContent={type:'tableContent';columnWidths:(number|undefined)[];headerRows?:number;headerCols?:number;rows:{cells:Cell[]}[]};
export function alignment(v:unknown):Alignment{if(v===undefined)return 'left';if(!['left','center','right','justify'].includes(String(v)))return invalid();return v as Alignment;}
export function normalizeTable(v:unknown):TableContent{
 const t=record(v);keys(t,['type','columnWidths','headerRows','headerCols','rows']);if(t.type!=='tableContent'||!Array.isArray(t.rows)||!t.rows.length||t.rows.length>200)return invalid();
 const rows=Array.from(t.rows,row=>{const r=record(row);keys(r,['cells']);if(!Array.isArray(r.cells)||r.cells.length>50)return invalid();return {cells:Array.from(r.cells,c=>{const x=Array.isArray(c)?{type:'tableCell',props:{},content:c}:record(c);keys(x,['type','props','content']);if(x.type!=='tableCell')return invalid();const p=record(x.props??{});if(x.props===null)return invalid();keys(p,['textColor','backgroundColor','textAlignment','colspan','rowspan']);const props:Cell['props']={textColor:color(p.textColor===undefined?'default':p.textColor),backgroundColor:color(p.backgroundColor===undefined?'default':p.backgroundColor),textAlignment:alignment(p.textAlignment)};for(const key of ['colspan','rowspan'] as const)if(p[key]!==undefined){if(!Number.isSafeInteger(p[key])||Number(p[key])<1||Number(p[key])>200)return invalid();props[key]=Number(p[key]);}return {type:'tableCell' as const,props,content:normalizeInline(x.content)};})};});
 // Verify the rectangular occupied grid, including merged cells, rather than just row lengths.
 const grid:boolean[][]=rows.map(()=>[]);let width=0;
 rows.forEach((row,r)=>{let c=0;for(const cell of row.cells){while(grid[r][c])c++;const cs=cell.props.colspan??1,rs=cell.props.rowspan??1;if(c+cs>50||r+rs>rows.length)return invalid();for(let y=r;y<r+rs;y++)for(let x=c;x<c+cs;x++){if(grid[y][x])return invalid();grid[y][x]=true;}c+=cs;}width=Math.max(width,grid[r].length);});
 if(!width||grid.some(row=>row.length!==width||Array.from({length:width},(_,i)=>row[i]).some(v=>!v)))return invalid();
 const widths=t.columnWidths===undefined?Array(width).fill(undefined):t.columnWidths;
 if(!Array.isArray(widths)||widths.length!==width)return invalid();
 const columnWidths=Array.from(widths,w=>{if(w==null)return undefined;if(typeof w!=='number'||!Number.isFinite(w)||w<1||w>10000)return invalid();return w;});
 const result:TableContent={type:'tableContent',columnWidths,rows};for(const key of ['headerRows','headerCols'] as const)if(t[key]!==undefined){const n=t[key];if(!Number.isSafeInteger(n)||Number(n)<0||Number(n)>(key==='headerRows'?rows.length:width))return invalid();result[key]=Number(n);}return result;
}

/** Rectangular text projection for Reference: spanned cells never shift neighboring columns. */
export function tableTextGrid(table:TableContent):string[][]{
 const result=table.rows.map(()=>Array<string>(table.columnWidths.length).fill('')),occupied=table.rows.map(()=>Array<boolean>(table.columnWidths.length).fill(false));
 table.rows.forEach((row,y)=>{let x=0;for(const cell of row.cells){while(occupied[y][x])x++;result[y][x]=inlineText(cell.content);for(let dy=y;dy<y+(cell.props.rowspan??1);dy++)for(let dx=x;dx<x+(cell.props.colspan??1);dx++)occupied[dy][dx]=true;x+=cell.props.colspan??1;}});return result;
}
