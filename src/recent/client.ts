import type {RecentReceipt} from './model.ts';
export async function recordRecentView(documentId:string,revision:number,signal?:AbortSignal):Promise<RecentReceipt>{
 const timeout=AbortSignal.timeout(15000);
 const response=await fetch(`/api/recent/${encodeURIComponent(documentId)}`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision}),signal:signal?AbortSignal.any([signal,timeout]):timeout});
 const data=await response.json();
 if(!response.ok)throw new Error(['FORBIDDEN','NOT_FOUND','VERSION_CHANGED'].includes(data?.error)?data.error:'RECORD_UNCONFIRMED');
 if(!data||data.documentId!==documentId||data.revision!==revision||typeof data.viewedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(data.viewedAt)||!Number.isFinite(Date.parse(data.viewedAt)))throw new Error('INVALID_ACK');
 return {documentId,revision,viewedAt:data.viewedAt};
}
