import type {FavoriteState,FavoritesPage} from './model.ts';
export class FavoriteRejected extends Error {}
function snapshot(value:unknown,id:string,revision:number,desired?:boolean):FavoriteState {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('INVALID_ACK');const x=value as FavoriteState;
 if(x.documentId!==id||x.revision!==revision||typeof x.saved!=='boolean'||(desired!==undefined&&x.saved!==desired))throw new Error('INVALID_ACK');return {documentId:id,revision,saved:x.saved};
}
export async function readFavoriteState(id:string,revision:number):Promise<FavoriteState>{
 const response=await fetch(`/api/favorites/${encodeURIComponent(id)}?revision=${revision}`,{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(15000)}),data=await response.json();
 if(!response.ok)throw new Error(['FORBIDDEN','NOT_FOUND','VERSION_CHANGED'].includes(data?.error)?data.error:'READ_FAILED');return snapshot(data,id,revision);
}
export async function setFavoriteState(id:string,revision:number,saved:boolean):Promise<FavoriteState>{
 const response=await fetch(`/api/favorites/${encodeURIComponent(id)}`,{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,saved}),signal:AbortSignal.timeout(20000)}),data=await response.json();
 if(!response.ok){if(response.status>=400&&response.status<500)throw new FavoriteRejected(['FORBIDDEN','NOT_FOUND','VERSION_CHANGED','INVALID_INPUT'].includes(data?.error)?data.error:'WRITE_REJECTED');throw new Error('UNKNOWN_RESULT');}return snapshot(data,id,revision,saved);
}

/** Refresh the list only after a confirmed mutation; never reload the document. */
export async function readFavoritesPage(page:number,locale:'zh-CN'|'en'='zh-CN'):Promise<FavoritesPage>{
 const response=await fetch(`/api/favorites?page=${page}${locale==='en'?'&lang=en':''}`,{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(15000)});
 if(response.status===403)throw new FavoriteRejected('FORBIDDEN');
 if(!response.ok)throw new Error('READ_FAILED');
 const value=await response.json();
 if(!value||!Array.isArray(value.items)||!Number.isSafeInteger(value.total)||value.total<0||!Number.isSafeInteger(value.page)||value.page<1||!Number.isSafeInteger(value.pages)||value.pages<value.page||value.items.some((item:unknown)=>{if(!item||typeof item!=='object')return true;const x=item as Record<string,unknown>;return typeof x.id!=='string'||typeof x.title!=='string'||!['article','ops','reference','qa'].includes(x.kind as string)||!Number.isSafeInteger(x.revision)||Number(x.revision)<1||!Array.isArray(x.tags)||x.tags.some(tag=>typeof tag!=='string');}))throw new Error('INVALID_PAGE');
 return value;
}
