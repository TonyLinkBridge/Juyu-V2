import type {ReviewerOptions,SubmitReviewInput,SubmitReviewResult} from './model';
export type ReviewerPage=ReviewerOptions;
export type ReviewSubmission=SubmitReviewInput;
export type SubmissionAck=SubmitReviewResult;
export class ReviewRejected extends Error {}
export async function readReviewers(id:string,sequence:number,after=''):Promise<ReviewerPage>{
 const r=await fetch(`/api/admin/review/${encodeURIComponent(id)}${after?`?after=${encodeURIComponent(after)}`:''}`,{cache:'no-store',signal:AbortSignal.timeout(15000)});const v=await r.json();
 if(!r.ok)throw new Error(v.error??'READ_FAILED');
 if(v.documentId!==id||!Number.isSafeInteger(v.sequence)||!Number.isSafeInteger(v.revision)||v.revision<1||!Array.isArray(v.reviewers)||v.reviewers.length>30||!v.reviewers.every((a:unknown)=>a!==null&&typeof a==='object'&&typeof (a as {id?:unknown}).id==='string'&&Boolean((a as {id:string}).id)&&typeof (a as {name?:unknown}).name==='string')||(v.nextCursor!==null&&(typeof v.nextCursor!=='string'||!v.nextCursor||v.nextCursor===after))||new Set(v.reviewers.map((a:{id:string})=>a.id)).size!==v.reviewers.length)throw new Error('READ_FAILED');
 if(v.sequence!==sequence)throw new Error('CONFLICT');
 if(v.lifecycle!=='active'||v.status!=='draft')throw new Error('INVALID_STATE');
 return v;
}
export async function submitReview(id:string,input:ReviewSubmission,revision:number):Promise<SubmissionAck>{
 const r=await fetch(`/api/admin/review/${encodeURIComponent(id)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(20000)});const v=await r.json();
 if(!r.ok){if(r.status>=400&&r.status<500)throw new ReviewRejected(v.error??'REJECTED');throw new Error('UNKNOWN_RESULT');}
 if(v.documentId!==id||v.sequence!==input.expectedSequence+1||v.revision!==revision||v.reviewerId!==input.reviewerId||v.status!=='in_review')throw new Error('INVALID_ACK');
 return v;
}
export function reviewError(error:unknown,reading=false){const code=error instanceof Error?error.message:'';return code==='EDIT_REQUIRED'?'请先根据退回原因修改并保存为新草稿，再提交二审。':code==='CONFLICT'?'文章版本已改变。请重新载入文章，核对后再提交。':code==='INVALID_REVIEWER'?'所选管理员已不可用，请重新读取管理员后再选择。':code==='FORBIDDEN'?'当前账号没有管理权限，请核对登录账号。':code==='UPLOAD_IN_PROGRESS'?'文件仍在上传，请等上传明确结束后再提交。':['INVALID_STATE','INACTIVE_DOCUMENT','NOT_FOUND'].includes(code)?'文章状态已改变，当前不能提交。请重新载入核对。':reading?'未能读取二审管理员。请重试；当前内容仍保留。':'提交结果尚未确认。为避免改动已提交的版本，编辑已暂停；请重试原提交，或重新载入核对。';}
