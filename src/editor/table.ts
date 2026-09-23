import {invalid,record,keys,color,displayColor,normalizeInline,inlineText,type EditorInline} from './inline.ts';
export type Alignment='left'|'center'|'right'|'justify';
export type TableBorderEdge='top'|'right'|'bottom'|'left';
export type TableBorderLine={width:1|2|3;color:string};
export type TableBorderCell=Partial<Record<TableBorderEdge,TableBorderLine|null>>;
export type TableBorderData=Record<string,TableBorderCell>;
export type TableBorderPreset='all'|'outside'|'inside'|'top'|'right'|'bottom'|'left'|'none';
export type TableVerticalAlignment='top'|'middle'|'bottom';
export type TableVerticalAlignData=Record<string,Exclude<TableVerticalAlignment,'top'>>;
export type TableCellAnchor={row:number;column:number;rowIndex:number;cellIndex:number;rowspan:number;colspan:number};
export type Cell={type:'tableCell';props:{textColor:string;backgroundColor:string;textAlignment:Alignment;colspan?:number;rowspan?:number};content:EditorInline[]};
export type TableContent={type:'tableContent';columnWidths:(number|undefined)[];headerRows?:number;headerCols?:number;rows:{cells:Cell[]}[]};
export function alignment(v:unknown):Alignment{if(v===undefined)return 'left';if(!['left','center','right','justify'].includes(String(v)))return invalid();return v as Alignment;}
const borderEdges:TableBorderEdge[]=['top','right','bottom','left'];
export function normalizeTableBorderData(value:unknown):string{
 if(value===undefined||value==='')return '';
 if(typeof value!=='string'||value.length>200000)return invalid();
 let parsed:unknown;try{parsed=JSON.parse(value);}catch{return invalid();}
 const input=record(parsed);if(Object.keys(input).length>10000)return invalid();
 const result:TableBorderData={};
 for(const [coordinate,rawCell] of Object.entries(input)){
  const match=coordinate.match(/^(0|[1-9]\d{0,2}):(0|[1-9]\d{0,1})$/);if(!match||Number(match[1])>=200||Number(match[2])>=50)return invalid();
  const inputCell=record(rawCell);keys(inputCell,borderEdges);const cell:TableBorderCell={};
  for(const edge of borderEdges){const raw=inputCell[edge];if(raw===undefined)continue;if(raw===null){cell[edge]=null;continue;}const line=record(raw);keys(line,['width','color']);if(![1,2,3].includes(Number(line.width))||!Number.isSafeInteger(line.width))return invalid();cell[edge]={width:line.width as 1|2|3,color:color(line.color)};}
  if(Object.keys(cell).length)result[coordinate]=cell;
 }
 return Object.keys(result).length?JSON.stringify(result):'';
}
export function tableBorderData(value:string|undefined):TableBorderData{return value?JSON.parse(normalizeTableBorderData(value)) as TableBorderData:{};}
export function tableCellBorderStyle(value:string|undefined,row:number,column:number):Partial<Record<'borderTop'|'borderRight'|'borderBottom'|'borderLeft',string>>{
 const cell=tableBorderData(value)[`${row}:${column}`];if(!cell)return {};
 const result:Partial<Record<'borderTop'|'borderRight'|'borderBottom'|'borderLeft',string>>={};
 for(const edge of borderEdges){const line=cell[edge];if(line===undefined)continue;result[`border${edge[0].toUpperCase()}${edge.slice(1)}` as keyof typeof result]=line===null?'none':`${line.width}px solid ${displayColor(line.color)??line.color}`;}
 return result;
}
export function normalizeTableVerticalAlignData(value:unknown):string{
 if(value===undefined||value==='')return '';
 if(typeof value!=='string'||value.length>100000)return invalid();
 let parsed:unknown;try{parsed=JSON.parse(value);}catch{return invalid();}
 const input=record(parsed);if(Object.keys(input).length>10000)return invalid();
 const result:TableVerticalAlignData={};
 for(const [coordinate,rawAlignment] of Object.entries(input)){
  const match=coordinate.match(/^(0|[1-9]\d{0,2}):(0|[1-9]\d{0,1})$/);if(!match||Number(match[1])>=200||Number(match[2])>=50)return invalid();
  if(rawAlignment==='top')continue;
  if(rawAlignment!=='middle'&&rawAlignment!=='bottom')return invalid();
  result[coordinate]=rawAlignment;
 }
 return Object.keys(result).length?JSON.stringify(result):'';
}
export function tableVerticalAlignData(value:string|undefined):TableVerticalAlignData{return value?JSON.parse(normalizeTableVerticalAlignData(value)) as TableVerticalAlignData:{};}
export function tableCellVerticalAlignStyle(value:string|undefined,row:number,column:number):{verticalAlign:TableVerticalAlignment}{return {verticalAlign:tableVerticalAlignData(value)[`${row}:${column}`]??'top'};}
export function tableCellAnchors(table:TableContent):TableCellAnchor[]{
 const occupied:(TableCellAnchor|undefined)[][]=table.rows.map(()=>[]),anchors:TableCellAnchor[]=[];
 table.rows.forEach((tableRow,rowIndex)=>{let column=0;tableRow.cells.forEach((cell,cellIndex)=>{while(occupied[rowIndex][column])column++;const anchor={row:rowIndex,column,rowIndex,cellIndex,rowspan:cell.props.rowspan??1,colspan:cell.props.colspan??1};anchors.push(anchor);for(let row=rowIndex;row<rowIndex+anchor.rowspan;row++)for(let col=column;col<column+anchor.colspan;col++)occupied[row][col]=anchor;column+=anchor.colspan;});});
 return anchors;
}
const opposite:Record<TableBorderEdge,TableBorderEdge>={top:'bottom',right:'left',bottom:'top',left:'right'};
export function applyTableBorderPreset(value:string,table:TableContent,coordinates:{row:number;column:number}[],preset:TableBorderPreset,line:TableBorderLine):string{
 const data=tableBorderData(value),anchors=tableCellAnchors(table),byKey=new Map(anchors.map(anchor=>[`${anchor.row}:${anchor.column}`,anchor])),grid:(TableCellAnchor|undefined)[][]=table.rows.map(()=>[]);
 for(const anchor of anchors)for(let row=anchor.row;row<anchor.row+anchor.rowspan;row++)for(let column=anchor.column;column<anchor.column+anchor.colspan;column++)grid[row][column]=anchor;
 const selected=new Set(coordinates.map(({row,column})=>`${row}:${column}`).filter(key=>byKey.has(key)));
 const neighbors=(anchor:TableCellAnchor,edge:TableBorderEdge)=>{const result=new Map<string,TableCellAnchor>();const add=(row:number,column:number)=>{const next=grid[row]?.[column];if(next&&next!==anchor)result.set(`${next.row}:${next.column}`,next);};if(edge==='top'||edge==='bottom'){const row=edge==='top'?anchor.row-1:anchor.row+anchor.rowspan;for(let column=anchor.column;column<anchor.column+anchor.colspan;column++)add(row,column);}else{const column=edge==='left'?anchor.column-1:anchor.column+anchor.colspan;for(let row=anchor.row;row<anchor.row+anchor.rowspan;row++)add(row,column);}return [...result.values()];};
 const set=(anchor:TableCellAnchor,edge:TableBorderEdge,next:TableBorderLine|null)=>{const key=`${anchor.row}:${anchor.column}`;data[key]??={};data[key][edge]=next;for(const neighbor of neighbors(anchor,edge)){const neighborKey=`${neighbor.row}:${neighbor.column}`;data[neighborKey]??={};data[neighborKey][opposite[edge]]=next;}};
 for(const key of selected){const anchor=byKey.get(key)!;for(const edge of borderEdges){const adjacent=neighbors(anchor,edge),hasSelectedNeighbor=adjacent.some(item=>selected.has(`${item.row}:${item.column}`));const applies=preset==='all'||preset==='none'||preset==='inside'&&hasSelectedNeighbor||preset==='outside'&&!hasSelectedNeighbor||preset===edge&&!hasSelectedNeighbor;if(applies)set(anchor,edge,preset==='none'?null:line);}}
 return normalizeTableBorderData(JSON.stringify(data));
}
export function applyTableVerticalAlignment(value:string,table:TableContent,coordinates:{row:number;column:number}[],alignment:TableVerticalAlignment):string{
 const data=tableVerticalAlignData(value),anchors=new Set(tableCellAnchors(table).map(anchor=>`${anchor.row}:${anchor.column}`));
 for(const {row,column} of coordinates){const key=`${row}:${column}`;if(!anchors.has(key))continue;if(alignment==='top')delete data[key];else data[key]=alignment;}
 return normalizeTableVerticalAlignData(JSON.stringify(data));
}
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
