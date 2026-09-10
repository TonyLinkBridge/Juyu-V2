import type {ControlDetail,ControlInput,ControlAck} from './control';
export class ControlRejected extends Error {}
const record=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const id=(value:unknown):value is string=>typeof value==='string'&&Boolean(value.trim());
const integer=(value:unknown,min=0)=>Number.isSafeInteger(value)&&Number(value)>=min;
export async function readControl(documentId:string,sequence:number,after=''):Promise<ControlDetail>{
 const response=await fetch(`/api/admin/review/${encodeURIComponent(documentId)}/control${after?`?after=${encodeURIComponent(after)}`:''}`,{cache:'no-store',signal:AbortSignal.timeout(15000)});const value:unknown=await response.json();
 if(!response.ok)throw new Error(record(value)&&typeof value.error==='string'?value.error:'READ_FAILED');
 if(!record(value)||value.documentId!==documentId||!integer(value.sequence,sequence)||!integer(value.revision,1)||typeof value.title!=='string'||!['draft','in_review','changes_requested','approved','queued','published'].includes(String(value.status))||!['active','archived','trashed'].includes(String(value.lifecycle))||!(value.publishedRevision===null||integer(value.publishedRevision,1))||!(value.submittedBy===null||id(value.submittedBy))||!(value.reviewerId===null||id(value.reviewerId))||!(value.reviewerName===null||typeof value.reviewerName==='string')||typeof value.reviewerAvailable!=='boolean'||typeof value.canManageReview!=='boolean'||!(value.nextCursor===null||id(value.nextCursor))||typeof value.historyMore!=='boolean'||!Array.isArray(value.reviewers)||!Array.isArray(value.history)||value.reviewers.length>30||value.history.length>20)throw new Error('READ_FAILED');
 if(value.canManageReview&&(value.status!=='in_review'||value.lifecycle!=='active'||!id(value.reviewerId)||!id(value.submittedBy)))throw new Error('READ_FAILED');
 const ids=new Set<string>();for(const reviewer of value.reviewers){if(!record(reviewer)||!id(reviewer.id)||typeof reviewer.name!=='string'||ids.has(reviewer.id)||reviewer.id===value.reviewerId||reviewer.id===value.submittedBy)throw new Error('READ_FAILED');ids.add(reviewer.id);}
 for(const entry of value.history){if(!record(entry)||!integer(entry.sequence,1)||Number(entry.sequence)>Number(value.sequence)||!integer(entry.revision,1)||!['reassign','withdraw'].includes(String(entry.action))||!id(entry.actorId)||typeof entry.actorName!=='string'||!(entry.previousReviewerName===null||typeof entry.previousReviewerName==='string')||!(entry.reviewerName===null||typeof entry.reviewerName==='string')||!(entry.previousReviewerId===null||id(entry.previousReviewerId))||!(entry.reviewerId===null||id(entry.reviewerId))||typeof entry.at!=='string'||!Number.isFinite(Date.parse(entry.at)))throw new Error('READ_FAILED');}
 return value as unknown as ControlDetail;
}
export async function sendControl(documentId:string,input:ControlInput,revision:number,previousReviewerId:string):Promise<ControlAck>{
 const response=await fetch(`/api/admin/review/${encodeURIComponent(documentId)}/control`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(20000)});const value:unknown=await response.json();
 if(!response.ok){if(response.status>=400&&response.status<500&&record(value)&&typeof value.error==='string')throw new ControlRejected(value.error);throw new Error('UNKNOWN_RESULT');}
 if(!record(value)||value.documentId!==documentId||value.sequence!==input.expectedSequence+1||value.revision!==revision||value.action!==input.action||value.status!==(input.action==='withdraw'?'draft':'in_review')||value.previousReviewerId!==previousReviewerId||value.reviewerId!==(input.action==='withdraw'?null:input.reviewerId))throw new Error('INVALID_ACK');
 return value as unknown as ControlAck;
}
export function controlError(error:unknown,reading=false){const code=error instanceof Error?error.message:'';
 if(reading)return code==='FORBIDDEN'?'当前账号没有审核管理权限，无法读取最新状态。':'未能读取最新审核状态或候选名单，已暂停操作。原有资料仍保留，请重新读取。';
 return code==='CONFLICT'?'文章版本已改变，操作未执行。请重新读取审核状态，核对后再操作。':['FORBIDDEN','INVALID_REVIEWER','REVIEWER_UNAVAILABLE','NOT_REVIEWER'].includes(code)?'账号权限或候选管理员已改变。请重新读取审核状态，再选择可用管理员。':['INVALID_STATE','INACTIVE_DOCUMENT','NOT_FOUND'].includes(code)?'文章或审核状态已改变。请重新读取审核状态。':error instanceof ControlRejected?'操作未执行，请重新读取审核状态后再操作。':'操作结果尚未确认。原操作与指定管理员已保留；请重试原操作完成核对。';
}
