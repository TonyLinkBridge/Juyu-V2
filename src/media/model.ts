export type TextBlock={id:string;type:'hint';style:'info'|'success'|'warning'|'danger';title:string;body:string}|{id:string;type:'code';language:string;code:string}|{id:string;type:'tabs';tabs:{id:string;title:string;body:string}[]};
export const hintLabels={info:'提示',success:'成功',warning:'注意',danger:'警告'};
export type ScienceBlock={id:string;type:'math';source:string;caption:string}|{id:string;type:'diagram';source:string;caption:string};
export type MediaBlock=ScienceBlock|TextBlock|{id:string;type:'image'|'video'|'file';assetId:string;caption:string;alt:string}|{id:string;type:'table';headers:string[];rows:string[][]};
export interface ManagedAsset {id:string;filename:string;mime:string;size:string;status:string}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function normalizeBlocks(value:unknown):MediaBlock[]{
 if(value===undefined)return [];
 const bad=()=>{throw new Error('INVALID_MEDIA');};
 if(!Array.isArray(value)||value.length>40)return bad();const ids=new Set<string>();
 const text=(v:unknown,max:number)=>{if(typeof v!=='string'||v.length>max||v.includes('\0'))return bad();return v;};
 const result=value.map(b=>{
  if(!b||typeof b!=='object'||!['image','video','file','table','hint','code','tabs','math','diagram'].includes(b.type)||typeof b.id!=='string'||!/^[-a-zA-Z0-9]{1,64}$/.test(b.id)||ids.has(b.id))return bad();ids.add(b.id);
  if(b.type==='math'||b.type==='diagram'){if(Object.keys(b).some(k=>!['id','type','source','caption'].includes(k)))return bad();return {id:b.id,type:b.type as 'math'|'diagram',source:text(b.source,b.type==='math'?2000:4000),caption:text(b.caption,500)} as ScienceBlock;}
  if(b.type==='hint'){
   if(Object.keys(b).some(k=>!['id','type','style','title','body'].includes(k))||!['info','success','warning','danger'].includes(b.style))return bad();
   return {id:b.id,type:'hint' as const,style:b.style as 'info'|'success'|'warning'|'danger',title:text(b.title,200),body:text(b.body,20000)};
  }
  if(b.type==='code'){
   if(Object.keys(b).some(k=>!['id','type','language','code'].includes(k))||typeof b.language!=='string'||!/^[-a-zA-Z0-9+#.]{0,30}$/.test(b.language))return bad();
   return {id:b.id,type:'code' as const,language:b.language,code:text(b.code,50000)};
  }
  if(b.type==='tabs'){
   if(Object.keys(b).some(k=>!['id','type','tabs'].includes(k))||!Array.isArray(b.tabs)||b.tabs.length<1||b.tabs.length>8)return bad();
   const tabIds=new Set<string>();const tabs=b.tabs.map((t:Record<string,unknown>)=>{if(!t||typeof t!=='object'||Object.keys(t).some(k=>!['id','title','body'].includes(k))||typeof t.id!=='string'||!/^[-a-zA-Z0-9]{1,64}$/.test(t.id)||tabIds.has(t.id))return bad();tabIds.add(t.id);return {id:t.id,title:text(t.title,100),body:text(t.body,20000)};});
   return {id:b.id,type:'tabs' as const,tabs};
  }
  if(b.type==='table'){
   if(Object.keys(b).some(k=>!['id','type','headers','rows'].includes(k))||!Array.isArray(b.headers)||b.headers.length<1||b.headers.length>8||!Array.isArray(b.rows)||b.rows.length>200)return bad();
   const headers=b.headers.map((v:unknown)=>text(v,200));const rows=b.rows.map((r:unknown)=>{if(!Array.isArray(r)||r.length!==headers.length)return bad();return r.map(v=>text(v,2000));});return {id:b.id,type:'table' as const,headers,rows};
  }
  if(Object.keys(b).some(k=>!['id','type','assetId','caption','alt'].includes(k))||typeof b.assetId!=='string'||!uuid.test(b.assetId))return bad();
  return {id:b.id,type:b.type as 'image'|'video'|'file',assetId:b.assetId,caption:text(b.caption,500),alt:text(b.alt,500)};
 });if(JSON.stringify(result).length>250000)return bad();return result;
}
export const uploadExtensions:Record<string,{mime:string;max:number}>={png:{mime:'image/png',max:5},jpg:{mime:'image/jpeg',max:5},jpeg:{mime:'image/jpeg',max:5},gif:{mime:'image/gif',max:5},webp:{mime:'image/webp',max:5},mp4:{mime:'video/mp4',max:50},webm:{mime:'video/webm',max:50},pdf:{mime:'application/pdf',max:20},txt:{mime:'text/plain',max:5},csv:{mime:'text/csv',max:5}};
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
 if(ext==='mp4')valid=b.subarray(4,8).toString()==='ftyp';
 if(ext==='webm')valid=b.subarray(0,4).equals(Buffer.from([26,69,223,163]));
 if(ext==='pdf')valid=b.subarray(0,5).toString()==='%PDF-';
 if(['txt','csv'].includes(ext)){try{new TextDecoder('utf-8',{fatal:true}).decode(b);valid=!b.includes(0);}catch{valid=false;}}
 if(!valid)throw new Error('INVALID_UPLOAD');return {filename:filename.trim(),mime:rule.mime,size:b.length};
}
