import {readerIconKey,type ReaderIconKey} from '../reader/icon-keys.ts';
import {decodeTabBody,normalizeTabBody} from './tab-body.ts';
import {safeLink} from '../editor/inline.ts';
import {inlineEmbed} from '../editor/inline-embed.ts';
import {externalLinkSource} from './external-embed.ts';
export type TextBlock={id:string;type:'hint';style:'info'|'success'|'warning'|'danger';title:string;body:string;showTitle?:boolean;iconKey?:ReaderIconKey|null}|{id:string;type:'code';language:string;code:string;title?:string;lineNumbers?:boolean;wrap?:boolean;expandable?:boolean;collapsedLines?:number;highlightLines?:string;addedLines?:string;removedLines?:string}|{id:string;type:'tabs';tabs:{id:string;title:string;body:string;iconKey?:ReaderIconKey|null}[]}|{id:string;type:'steps';steps:{id:string;title:string;body:string}[]}|{id:string;type:'columns';columns:{id:string;title:string;body:string}[]};
export const hintLabels={info:'提示',success:'成功',warning:'注意',danger:'警告'};
export type ScienceBlock={id:string;type:'math';source:string;caption:string}|{id:string;type:'diagram';source:string;caption:string};
export type MediaBlock=ScienceBlock|TextBlock|{id:string;type:'articleReference';targetId:string}|{id:string;type:'button';label:string;href:string;variant:'primary'|'secondary'}|{id:string;type:'externalEmbed';url:string;caption:string}|{id:string;type:'image'|'video'|'audio'|'file';assetId:string;caption:string;alt:string;darkAssetId?:string|null}|{id:string;type:'table';headers:string[];rows:string[][];view?:'grid'|'cards';searchable?:boolean;stickyHeader?:boolean;stickyFirstColumn?:boolean};
export function blockAssetIds(block:MediaBlock):string[]{
 if('assetId' in block)return [block.assetId,...(block.type==='image'&&block.darkAssetId?[block.darkAssetId]:[])];
 const bodies=block.type==='tabs'?block.tabs.map(tab=>tab.body):block.type==='steps'?block.steps.map(step=>step.body):block.type==='columns'?block.columns.map(column=>column.body):[];
 const result:string[]=[];
 for(const body of bodies){const nodes=decodeTabBody(body);if(!nodes)continue;const visit=(items:typeof nodes)=>{for(const node of items){if(node.type==='image'){const id=node.props.url.match(/^\/api\/assets\/([0-9a-f-]{36})$/i)?.[1];if(id)result.push(id);}const contents=node.type==='table'?node.content.rows.flatMap(row=>row.cells.map(cell=>cell.content)):'content' in node?[node.content]:[];for(const content of contents)for(const inline of content)if(inline.type==='link'){const embed=inlineEmbed(inline.href);if(embed?.type==='image')result.push(embed.assetId);}visit(node.children);}};visit(nodes);}
 return result;
}
export interface ManagedAsset {id:string;filename:string;mime:string;size:string;status:string}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function normalizeBlocks(value:unknown):MediaBlock[]{
 if(value===undefined)return [];
 const bad=()=>{throw new Error('INVALID_MEDIA');};
 if(!Array.isArray(value)||value.length>40)return bad();const ids=new Set<string>();
 const text=(v:unknown,max:number)=>{if(typeof v!=='string'||v.length>max||v.includes('\0'))return bad();return v;};
 const result=value.map(b=>{
  if(!b||typeof b!=='object'||!['image','video','audio','file','table','hint','code','tabs','steps','columns','math','diagram','articleReference','button','externalEmbed'].includes(b.type)||typeof b.id!=='string'||!/^[-a-zA-Z0-9]{1,64}$/.test(b.id)||ids.has(b.id))return bad();ids.add(b.id);
  if(b.type==='externalEmbed'){
   if(Object.keys(b).some(k=>!['id','type','url','caption'].includes(k))||typeof b.url!=='string'||!externalLinkSource(b.url))return bad();
   return {id:b.id,type:'externalEmbed' as const,url:b.url,caption:text(b.caption,300)};
  }
  if(b.type==='articleReference'){
   if(Object.keys(b).some(k=>!['id','type','targetId'].includes(k))||typeof b.targetId!=='string'||!/^[-a-zA-Z0-9_]{1,128}$/.test(b.targetId))return bad();
   return {id:b.id,type:'articleReference' as const,targetId:b.targetId};
  }
  if(b.type==='button'){
   if(Object.keys(b).some(k=>!['id','type','label','href','variant'].includes(k))||typeof b.label!=='string'||!b.label.trim()||b.label.length>80||typeof b.href!=='string'||!safeLink(b.href)||!['primary','secondary'].includes(b.variant))return bad();
   return {id:b.id,type:'button' as const,label:text(b.label,80),href:b.href,variant:b.variant as 'primary'|'secondary'};
  }
  if(b.type==='math'||b.type==='diagram'){if(Object.keys(b).some(k=>!['id','type','source','caption'].includes(k)))return bad();return {id:b.id,type:b.type as 'math'|'diagram',source:text(b.source,b.type==='math'?2000:4000),caption:text(b.caption,500)} as ScienceBlock;}
  if(b.type==='hint'){
   if(Object.keys(b).some(k=>!['id','type','style','title','body','showTitle','iconKey'].includes(k))||!['info','success','warning','danger'].includes(b.style)||b.showTitle!==undefined&&typeof b.showTitle!=='boolean'||b.iconKey!==undefined&&b.iconKey!==null&&readerIconKey(b.iconKey)===null)return bad();
   return {id:b.id,type:'hint' as const,style:b.style as 'info'|'success'|'warning'|'danger',title:text(b.title,200),body:text(b.body,20000),...(b.showTitle===undefined?{}:{showTitle:b.showTitle as boolean}),...(b.iconKey===undefined?{}:{iconKey:b.iconKey as ReaderIconKey|null})};
  }
  if(b.type==='code'){
   if(Object.keys(b).some(k=>!['id','type','language','code','title','lineNumbers','wrap','expandable','collapsedLines','highlightLines','addedLines','removedLines'].includes(k))||typeof b.language!=='string'||!/^[-a-zA-Z0-9+#.]{0,30}$/.test(b.language)||['lineNumbers','wrap','expandable'].some(k=>b[k]!==undefined&&typeof b[k]!=='boolean')||b.collapsedLines!==undefined&&(!Number.isInteger(b.collapsedLines)||b.collapsedLines<2||b.collapsedLines>40)||['highlightLines','addedLines','removedLines'].some(k=>b[k]!==undefined&&(typeof b[k]!=='string'||b[k].length>200||!/^[0-9,\s-]*$/.test(b[k]))))return bad();
   return {id:b.id,type:'code' as const,language:b.language,code:text(b.code,50000),...(b.title===undefined?{}:{title:text(b.title,120)}),...(b.lineNumbers===undefined?{}:{lineNumbers:b.lineNumbers as boolean}),...(b.wrap===undefined?{}:{wrap:b.wrap as boolean}),...(b.expandable===undefined?{}:{expandable:b.expandable as boolean}),...(b.collapsedLines===undefined?{}:{collapsedLines:b.collapsedLines as number}),...(b.highlightLines===undefined?{}:{highlightLines:b.highlightLines as string}),...(b.addedLines===undefined?{}:{addedLines:b.addedLines as string}),...(b.removedLines===undefined?{}:{removedLines:b.removedLines as string})};
  }
  if(b.type==='tabs'){
   if(Object.keys(b).some(k=>!['id','type','tabs'].includes(k))||!Array.isArray(b.tabs)||b.tabs.length<1||b.tabs.length>8)return bad();
   const tabIds=new Set<string>();const tabs=b.tabs.map((t:Record<string,unknown>)=>{if(!t||typeof t!=='object'||Object.keys(t).some(k=>!['id','title','body','iconKey'].includes(k))||typeof t.id!=='string'||!/^[-a-zA-Z0-9]{1,64}$/.test(t.id)||tabIds.has(t.id)||t.iconKey!==undefined&&t.iconKey!==null&&readerIconKey(t.iconKey)===null)return bad();tabIds.add(t.id);return {id:t.id,title:text(t.title,100),body:normalizeTabBody(text(t.body,20000)),...(t.iconKey===undefined?{}:{iconKey:t.iconKey as ReaderIconKey|null})};});
   return {id:b.id,type:'tabs' as const,tabs};
  }
  if(b.type==='steps'){
   if(Object.keys(b).some(k=>!['id','type','steps'].includes(k))||!Array.isArray(b.steps)||b.steps.length<1||b.steps.length>20)return bad();
   const stepIds=new Set<string>();const steps=b.steps.map((step:Record<string,unknown>)=>{if(!step||typeof step!=='object'||Object.keys(step).some(k=>!['id','title','body'].includes(k))||typeof step.id!=='string'||!/^[-a-zA-Z0-9]{1,64}$/.test(step.id)||stepIds.has(step.id))return bad();stepIds.add(step.id);return {id:step.id,title:text(step.title,120),body:normalizeTabBody(text(step.body,20000))};});
   return {id:b.id,type:'steps' as const,steps};
  }
  if(b.type==='columns'){
   if(Object.keys(b).some(k=>!['id','type','columns'].includes(k))||!Array.isArray(b.columns)||b.columns.length<2||b.columns.length>3)return bad();
   const columnIds=new Set<string>();const columns=b.columns.map((column:Record<string,unknown>)=>{if(!column||typeof column!=='object'||Object.keys(column).some(k=>!['id','title','body'].includes(k))||typeof column.id!=='string'||!/^[-a-zA-Z0-9]{1,64}$/.test(column.id)||columnIds.has(column.id))return bad();columnIds.add(column.id);return {id:column.id,title:text(column.title,120),body:normalizeTabBody(text(column.body,20000))};});
   return {id:b.id,type:'columns' as const,columns};
  }
  if(b.type==='table'){
   if(Object.keys(b).some(k=>!['id','type','headers','rows','view','searchable','stickyHeader','stickyFirstColumn'].includes(k))||!Array.isArray(b.headers)||b.headers.length<1||b.headers.length>8||!Array.isArray(b.rows)||b.rows.length>200||b.view!==undefined&&!['grid','cards'].includes(b.view)||['searchable','stickyHeader','stickyFirstColumn'].some(k=>b[k]!==undefined&&typeof b[k]!=='boolean'))return bad();
   const headers=b.headers.map((v:unknown)=>text(v,200));const rows=b.rows.map((r:unknown)=>{if(!Array.isArray(r)||r.length!==headers.length)return bad();return r.map(v=>text(v,2000));});return {id:b.id,type:'table' as const,headers,rows,...(b.view===undefined?{}:{view:b.view as 'grid'|'cards'}),...(b.searchable===undefined?{}:{searchable:b.searchable as boolean}),...(b.stickyHeader===undefined?{}:{stickyHeader:b.stickyHeader as boolean}),...(b.stickyFirstColumn===undefined?{}:{stickyFirstColumn:b.stickyFirstColumn as boolean})};
  }
  if(Object.keys(b).some(k=>!['id','type','assetId','caption','alt',...(b.type==='image'?['darkAssetId']:[])].includes(k))||typeof b.assetId!=='string'||!uuid.test(b.assetId)||b.darkAssetId!==undefined&&b.darkAssetId!==null&&(!uuid.test(b.darkAssetId)||b.darkAssetId===b.assetId))return bad();
  return {id:b.id,type:b.type as 'image'|'video'|'audio'|'file',assetId:b.assetId,caption:text(b.caption,500),alt:text(b.alt,500),...(b.darkAssetId===undefined?{}:{darkAssetId:b.darkAssetId as string|null})};
 });if(JSON.stringify(result).length>250000)return bad();return result;
}
export const uploadExtensions:Record<string,{mime:string;max:number}>={png:{mime:'image/png',max:5},jpg:{mime:'image/jpeg',max:5},jpeg:{mime:'image/jpeg',max:5},gif:{mime:'image/gif',max:5},webp:{mime:'image/webp',max:5},mp3:{mime:'audio/mpeg',max:20},ogg:{mime:'audio/ogg',max:20},mp4:{mime:'video/mp4',max:50},webm:{mime:'video/webm',max:50},pdf:{mime:'application/pdf',max:20},txt:{mime:'text/plain',max:5},csv:{mime:'text/csv',max:5}};
export function uploadMetadata(filename:string,bytes:Uint8Array){
 if(!filename.trim()||filename.length>200||/[\x00-\x1f\x7f/\\]/.test(filename))throw new Error('INVALID_UPLOAD');
 const ext=filename.split('.').pop()?.toLowerCase()??'',rule=uploadExtensions[ext];if(!rule)throw new Error('INVALID_UPLOAD');
 if(!bytes.length||bytes.length>rule.max*1024*1024)throw new Error('UPLOAD_TOO_LARGE');
 // Signature validation is read-only; preserve the input view without copying the file.
 const b=Buffer.from(bytes.buffer,bytes.byteOffset,bytes.byteLength);let valid=false;
 if(ext==='png')valid=b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 if(['jpg','jpeg'].includes(ext))valid=b[0]===255&&b[1]===216&&b[2]===255;
 if(ext==='gif')valid=['GIF87a','GIF89a'].includes(b.subarray(0,6).toString());
 if(ext==='webp')valid=b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP';
 if(ext==='mp3')valid=b.subarray(0,3).toString()==='ID3'||(b[0]===255&&(b[1]&224)===224);
 if(ext==='ogg')valid=b.subarray(0,4).toString()==='OggS';
 if(ext==='mp4')valid=b.subarray(4,8).toString()==='ftyp';
 if(ext==='webm')valid=b.subarray(0,4).equals(Buffer.from([26,69,223,163]));
 if(ext==='pdf')valid=b.subarray(0,5).toString()==='%PDF-';
 if(['txt','csv'].includes(ext)){try{new TextDecoder('utf-8',{fatal:true}).decode(b);valid=!b.includes(0);}catch{valid=false;}}
 if(!valid)throw new Error('INVALID_UPLOAD');return {filename:filename.trim(),mime:rule.mime,size:b.length};
}
