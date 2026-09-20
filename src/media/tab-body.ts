import {normalizeEditorBlocks,type EditorBlock} from '../editor/document.ts';

export const TAB_BODY_PREFIX='JUYU_TAB_BLOCKNOTE_V1\n';
const allowed=new Set(['paragraph','heading','bulletListItem','numberedListItem','checkListItem','toggleListItem','quote','codeBlock','table','divider','image']);

function validateTypes(nodes:unknown,depth=1,count={value:0}):void {
 if(!Array.isArray(nodes)||depth>8)throw new Error('INVALID_MEDIA');
 for(const node of nodes){
  if(!node||typeof node!=='object'||Array.isArray(node)||!allowed.has((node as {type?:string}).type??'')||++count.value>100)throw new Error('INVALID_MEDIA');
  validateTypes((node as {children?:unknown}).children??[],depth+1,count);
 }
}

export function decodeTabBody(value:string):EditorBlock[]|null {
 if(!value.startsWith(TAB_BODY_PREFIX))return null;
 if(value.length>20000)throw new Error('INVALID_MEDIA');
 let parsed:unknown;try{parsed=JSON.parse(value.slice(TAB_BODY_PREFIX.length));}catch{throw new Error('INVALID_MEDIA');}
 validateTypes(parsed);
 try{return normalizeEditorBlocks(parsed);}catch{throw new Error('INVALID_MEDIA');}
}

export function encodeTabBody(value:unknown):string {
 validateTypes(value);
 let normalized:EditorBlock[];try{normalized=normalizeEditorBlocks(value);}catch{throw new Error('INVALID_MEDIA');}
 const result=TAB_BODY_PREFIX+JSON.stringify(normalized);
 if(result.length>20000)throw new Error('INVALID_MEDIA');
 return result;
}

export function normalizeTabBody(value:string):string {
 const blocks=decodeTabBody(value);return blocks===null?value:encodeTabBody(blocks);
}
