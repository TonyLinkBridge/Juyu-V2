import type {PublicationDetail,PublicationInput,PublicationAck} from './publication.ts';
import {recoverySnapshot} from '../editor/recovery.ts';
export class PublicationRejected extends Error {}
const record=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const id=(v:unknown):v is string=>typeof v==='string'&&Boolean(v.trim());
const integer=(v:unknown,min=1)=>Number.isSafeInteger(v)&&Number(v)>=min;
const date=(v:unknown):v is string=>typeof v==='string'&&Number.isFinite(Date.parse(v));
export async function readPublication(documentId:string,sequence:number):Promise<PublicationDetail>{
 const response=await fetch(`/api/admin/review/${encodeURIComponent(documentId)}/publication`,{cache:'no-store',signal:AbortSignal.timeout(15000)});const value:unknown=await response.json();
 if(!response.ok)throw new Error(record(value)&&typeof value.error==='string'?value.error:'READ_FAILED');
 if(!record(value)||!integer(value.revision)||typeof value.canQueue!=='boolean'||typeof value.canPublish!=='boolean'||typeof value.historyMore!=='boolean'||!Array.isArray(value.history)||value.history.length>20)throw new Error('READ_FAILED');
 const article=recoverySnapshot(value.article,documentId,sequence),approval=value.approval;
 if(!(article.publishedRevision===null||integer(article.publishedRevision)))throw new Error('READ_FAILED');
 if(approval!==null&&(!record(approval)||approval.revision!==value.revision||!id(approval.reviewerId)||typeof approval.reviewerName!=='string'||!date(approval.approvedAt)))throw new Error('READ_FAILED');
 if(value.canQueue&&(article.status!=='approved'||article.lifecycle!=='active'||!approval)||value.canPublish&&(article.status!=='queued'||article.lifecycle!=='active'||!approval))throw new Error('READ_FAILED');
 let last=article.sequence+1;
 for(const h of value.history){if(!record(h)||!integer(h.sequence)||Number(h.sequence)>=last||!integer(h.revision)||!['queue','publish'].includes(String(h.action))||!id(h.actorId)||typeof h.actorName!=='string'||!date(h.at))throw new Error('READ_FAILED');last=Number(h.sequence);}
 return {...value,article} as unknown as PublicationDetail;
}
export async function sendPublication(documentId:string,input:PublicationInput,revision:number,approvedBy:string,previousPublication:number|null):Promise<PublicationAck>{
 const response=await fetch(`/api/admin/review/${encodeURIComponent(documentId)}/publication`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(20000)});const value:unknown=await response.json();
 if(!response.ok){if(response.status>=400&&response.status<500&&record(value)&&typeof value.error==='string')throw new PublicationRejected(value.error);throw new Error('UNKNOWN_RESULT');}
 if(!record(value)||value.documentId!==documentId||value.sequence!==input.expectedSequence+1||value.revision!==revision||value.action!==input.action||value.status!==(input.action==='queue'?'queued':'published')||value.publishedRevision!==(input.action==='queue'?previousPublication:revision)||value.approvedBy!==approvedBy)throw new Error('INVALID_ACK');
 return value as unknown as PublicationAck;
}
export function publicationError(error:unknown,reading=false):string {
 const code=error instanceof Error?error.message:'';
 if(reading)return code==='FORBIDDEN'?'当前账号没有发布管理权限，无法读取最新状态。':'未能读取最新发布状态。已暂停操作，请重新读取后核对。';
 if(error instanceof PublicationRejected){
  if(code==='INVALID_APPROVAL')return '当前版本缺少有效的二审批准，操作未执行。请重新读取并核对审核记录。';
  if(['INVALID_MEDIA','UPLOAD_IN_PROGRESS'].includes(code))return '附件尚未就绪或已不可用，操作未执行。请处理附件后重新读取状态。';
  return '账号权限、文章或审核状态已改变，操作未执行。请重新读取后再操作。';
 }
 return '操作结果尚未确认。已保留原操作及版本，请重试原操作完成核对。';
}
