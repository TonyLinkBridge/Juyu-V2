/** Shared, environment-independent native inline validation. Never accepts executable CSS/URLs. */
export type EditorStyles=Partial<Record<'bold'|'italic'|'underline'|'strike'|'code',boolean>> & {textColor?:string;backgroundColor?:string};
export interface EditorText {type:'text';text:string;styles:EditorStyles}
export type EditorInline=EditorText|{type:'link';href:string;content:EditorText[]};
export const invalid=():never=>{throw new Error('INVALID_EDITOR_DOCUMENT');};
export const record=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))return invalid();return v as Record<string,unknown>;};
export const keys=(v:Record<string,unknown>,allowed:string[])=>{if(Object.keys(v).some(k=>!allowed.includes(k)))invalid();};
export const boundedText=(v:unknown,max=50000):string=>{if(typeof v!=='string'||v.length>max||v.includes('\0'))return invalid();return v;};
export function safeLink(v:unknown):v is string {
 if(typeof v!=='string'||!v||v.length>2048||/[\x00-\x20\x7f\\]/.test(v))return false;
 if(/^#[a-zA-Z0-9_-]+$/.test(v)||/^\/(?!\/)[^\\]*$/.test(v))return true;
 try{const u=new URL(v);return ['http:','https:','mailto:','tel:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}
}
export function color(v:unknown):string {
 const value=boundedText(v,100);
 if(!/^(?:[a-zA-Z]{1,30}|#[0-9a-fA-F]{3,8}|(?:rgb|hsl)a?\([0-9.,%\s/+\-deg]+\))$/.test(value))return invalid();return value;
}
export function normalizeInline(v:unknown,plain=false):EditorInline[]{
 if(!Array.isArray(v)||v.length>10000)return invalid();
 return Array.from(v,item=>{const x=record(item);
  if(x.type==='link'&&!plain){keys(x,['type','href','content']);if(!safeLink(x.href))return invalid();const content=normalizeInline(x.content);if(content.some(c=>c.type!=='text'))return invalid();return {type:'link',href:x.href,content:content as EditorText[]};}
  keys(x,['type','text','styles']);if(x.type!=='text')return invalid();const s=record(x.styles??{});keys(s,plain?[]:['bold','italic','underline','strike','code','textColor','backgroundColor']);if(x.styles===null)return invalid();const styles:EditorStyles={};
  for(const [key,value] of Object.entries(s)){if(key==='textColor'||key==='backgroundColor')styles[key]=color(value);else{if(typeof value!=='boolean')return invalid();styles[key as 'bold']=value;}}
  return {type:'text',text:boundedText(x.text),styles};
 });
}
export const inlineText=(content:EditorInline[]):string=>content.map(c=>c.type==='text'?c.text:c.content.map(t=>t.text).join('')).join('');
const palette:Record<string,[string,string]>={gray:['#9b9a97','#ebeced'],brown:['#64473a','#e9e5e3'],red:['#e03e3e','#fbe4e4'],orange:['#d9730d','#f6e9d9'],yellow:['#dfab01','#fbf3db'],green:['#4d6461','#ddedea'],blue:['#0b6e99','#ddebf1'],purple:['#6940a5','#eae4f2'],pink:['#ad1a72','#f4dfeb']};
export const displayColor=(v:string|undefined,background=false)=>!v||v==='default'?undefined:palette[v]?.[background?1:0]??v;
