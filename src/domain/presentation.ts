import {normalizeBlocks,type MediaBlock} from '../media/model.ts';
import {readerIconKey,type ReaderIconKey} from '../reader/icon-keys.ts';
export interface ArticleCover {assetId:string;alt:string;position:number}
export interface ArticlePresentation {description?:string;releaseNote?:string;tags?:string[];cover?:ArticleCover|null;blocks?:MediaBlock[];iconKey?:ReaderIconKey|null}
export function normalizeDescription(value:unknown):string {
 if(value===undefined)return '';
 if(typeof value!=='string'||[...value].length>300||/[\u0000-\u001f\u007f]/.test(value))throw new Error('INVALID_DESCRIPTION');
 return value.trim();
}
export function normalizeReleaseNote(value:unknown):string {
 if(value===undefined)return '';
 if(typeof value!=='string'||[...value].length>600||/[\u0000-\u0009\u000b-\u001f\u007f]/.test(value))throw new Error('INVALID_RELEASE_NOTE');
 return value.trim();
}
export const COVER_MIME_TYPES = ['image/png','image/jpeg','image/webp','image/gif'] as const;
export function normalizePresentation(input:ArticlePresentation):{tags:string[];cover:ArticleCover|null;blocks:MediaBlock[];iconKey?:ReaderIconKey|null} {
 const invalid=()=>new Error('INVALID_PRESENTATION: 标签或封面设置不正确');
 const source=input.tags===undefined?[]:input.tags;
 if(!Array.isArray(source)||source.length>12)throw invalid();
 const tags:string[]=[];
 for(const item of source){
   if(typeof item!=='string'||/[\u0000-\u001f\u007f]/.test(item))throw invalid();
   const tag=item.trim().normalize('NFC');
   if(!tag||[...tag].length>40)throw invalid();
   if(!tags.includes(tag))tags.push(tag);
 }
 const raw=input.cover;
 let cover:ArticleCover|null=null;
 if(raw!==undefined&&raw!==null){
   if(typeof raw!=='object'||typeof raw.assetId!=='string'||!/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(raw.assetId)
     ||typeof raw.alt!=='string'||[...raw.alt].length>200||/[\u0000-\u001f\u007f]/.test(raw.alt)
     ||!Number.isFinite(raw.position)||raw.position<0||raw.position>100)throw invalid();
   cover={assetId:raw.assetId.toLowerCase(),alt:raw.alt.trim(),position:raw.position};
 }
 if(input.iconKey!==undefined&&input.iconKey!==null&&readerIconKey(input.iconKey)===null)throw invalid();
 return {tags,cover,blocks:normalizeBlocks(input.blocks),...(input.iconKey===undefined?{}:{iconKey:input.iconKey})};
}
