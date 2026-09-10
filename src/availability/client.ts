import type {AvailabilityAck,AvailabilityDetail,AvailabilityInput} from './model.ts';
export class AvailabilityRejected extends Error {}
const record=(x:unknown):x is Record<string,unknown>=>Boolean(x)&&typeof x==='object'&&!Array.isArray(x);
const integer=(x:unknown,min=1)=>Number.isSafeInteger(x)&&Number(x)>=min;
const identifier=(x:unknown)=>typeof x==='string'&&Boolean(x.trim());
export async function readAvailability(id:string,sequence:number):Promise<AvailabilityDetail>{
 const r=await fetch(`/api/admin/availability/${encodeURIComponent(id)}`,{cache:'no-store',signal:AbortSignal.timeout(15000)}),v:unknown=await r.json();
 if(!r.ok)throw new Error(record(v)&&typeof v.error==='string'?v.error:'READ_FAILED');
 if(!record(v)||v.documentId!==id||typeof v.title!=='string'||!integer(v.sequence,sequence)||!integer(v.revision)||!['active','archived','trashed'].includes(String(v.lifecycle))||!['draft','in_review','changes_requested','approved','queued','published'].includes(String(v.status))||!(v.publishedRevision===null||integer(v.publishedRevision))||['canArchive','canUnpublish','canUnarchive','historyMore'].some(k=>typeof v[k]!=='boolean')||!Array.isArray(v.history)||v.history.length>20)throw new Error('READ_FAILED');
 if(v.canArchive&&v.lifecycle!=='active'||v.canUnpublish&&(v.lifecycle!=='active'||v.publishedRevision===null)||v.canUnarchive&&v.lifecycle!=='archived')throw new Error('READ_FAILED');
 let last=Number(v.sequence)+1;for(const h of v.history){if(!record(h)||!integer(h.sequence)||Number(h.sequence)>=last||!integer(h.revision)||!['archive','unarchive','unpublish'].includes(String(h.action))||!identifier(h.actorId)||typeof h.actorName!=='string'||!(h.previousPublishedRevision===null||integer(h.previousPublishedRevision))||typeof h.at!=='string'||!Number.isFinite(Date.parse(h.at)))throw new Error('READ_FAILED');last=Number(h.sequence);}
 return v as unknown as AvailabilityDetail;
}
export async function sendAvailability(id:string,input:AvailabilityInput,revision:number):Promise<AvailabilityAck>{
 const r=await fetch(`/api/admin/availability/${encodeURIComponent(id)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(20000)}),v:unknown=await r.json();
 if(!r.ok){if(r.status>=400&&r.status<500&&record(v)&&typeof v.error==='string')throw new AvailabilityRejected(v.error);throw new Error('UNKNOWN_RESULT');}
 if(!record(v)||v.documentId!==id||v.sequence!==input.expectedSequence+1||v.revision!==revision||v.action!==input.action||v.lifecycle!==(input.action==='archive'?'archived':'active')||v.status!=='draft'||v.publishedRevision!==null)throw new Error('INVALID_ACK');
 return v as unknown as AvailabilityAck;
}
export function availabilityError(e:unknown,reading=false){
 const code=e instanceof Error?e.message:'';
 if(reading)return code==='FORBIDDEN'?'当前账号没有管理权限，无法读取最新资料状态。':'未能读取最新资料状态，已暂停操作。请重新读取后核对。';
 if(e instanceof AvailabilityRejected)return code==='MEMBER_BUSY'?'成员状态正在更新，操作未执行。请稍后重新读取资料状态再确认。':code==='UPLOAD_IN_PROGRESS'?'本篇文章还有未完成的上传，操作未执行。请处理上传后重新读取状态。':'账号权限或文章状态已改变，操作未执行。请重新读取后再确认。';
 return '操作结果尚未确认。原操作及版本已保留，请重试原操作完成核对。';
}
