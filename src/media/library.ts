export type FileCategory='all'|'image'|'video'|'audio'|'file';
export interface LibraryQuery {q:string;type:FileCategory;sort:'recent'|'name'|'size';direction?:'asc'|'desc';page:number;view:'grid'|'list';file?:string}
export interface LibraryAsset {id:string;filename:string;mime:string;size:string;createdAt:string;documentId:string;documentTitle:string;uploadedBy:string;canUpload:boolean;usages:{state:'draft'|'published';usage:'inline'|'cover'|'attachment'}[]}
export interface MediaLibraryData {query:LibraryQuery;items:LibraryAsset[];total:number;page:number;pages:number;counts:Record<FileCategory,number>;selected:LibraryAsset|null}
export interface UploadTargets {items:{id:string;title:string}[];page:number;pages:number;total:number}
const types:FileCategory[]=['all','image','video','audio','file'];
export function libraryQuery(input:Record<string,unknown>):LibraryQuery{
 if(Object.keys(input).some(k=>!['q','type','sort','direction','page','view','file'].includes(k))||Object.values(input).some(v=>v!==undefined&&typeof v!=='string'))throw new Error('INVALID_INPUT');
 const q=(input.q as string|undefined)??'',type=(input.type??'all') as FileCategory,sort=(input.sort??'recent') as LibraryQuery['sort'],view=(input.view??'grid') as LibraryQuery['view'];
 if(q.length>120||/[\x00-\x1f\x7f]/.test(q)||!types.includes(type)||!['recent','name','size'].includes(sort)||!['grid','list'].includes(view))throw new Error('INVALID_INPUT');
 if(input.direction!==undefined&&!['asc','desc'].includes(String(input.direction)))throw new Error('INVALID_INPUT');
 const page=Number(input.page??1);if(!Number.isSafeInteger(page)||page<1||page>999999||! /^[1-9]\d*$/.test(String(input.page??1)))throw new Error('INVALID_INPUT');
 const file=input.file as string|undefined;if(file!==undefined&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(file))throw new Error('INVALID_INPUT');
 return {q:q.trim(),type,sort,...(input.direction?{direction:input.direction as 'asc'|'desc'}:{}),page,view,...(file?{file}:{})};
}
export function libraryHref(query:LibraryQuery,changes:Partial<LibraryQuery>={}){
 const q={...query,...changes},params=new URLSearchParams();if(q.q)params.set('q',q.q);if(q.type!=='all')params.set('type',q.type);if(q.sort!=='recent')params.set('sort',q.sort);if(q.direction&&q.direction!==(q.sort==='name'?'asc':'desc'))params.set('direction',q.direction);if(q.page>1)params.set('page',String(q.page));if(q.view!=='grid')params.set('view',q.view);if(q.file)params.set('file',q.file);return `/admin/media${params.size?'?'+params:''}`;
}
export function libraryOrder(query:LibraryQuery){const direction=(query.direction??(query.sort==='name'?'asc':'desc')).toUpperCase();const column=query.sort==='name'?'a.filename COLLATE \"C\"':query.sort==='size'?'a.byte_size':'a.created_at';return `${column} ${direction},a.id`;}
export function fileCategory(mime:string):Exclude<FileCategory,'all'>{return mime.startsWith('image/')?'image':mime.startsWith('video/')?'video':mime.startsWith('audio/')?'audio':'file';}
export function formatBytes(size:string){const bytes=Number(size);if(!Number.isFinite(bytes)||bytes<0)return '未知大小';if(bytes<1024)return `${bytes} B`;if(bytes<1048576)return `${Math.round(bytes/1024)} KB`;return `${new Intl.NumberFormat('zh-CN',{maximumFractionDigits:1}).format(bytes/1048576)} MB`;}
