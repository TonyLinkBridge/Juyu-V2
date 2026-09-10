import type {FavoriteState} from './model.ts';
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
