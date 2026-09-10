import type {ReviewDetail,DecisionInput,DecisionAck} from './decision';
import {recoverySnapshot} from '../editor/recovery';
export class DecisionRejected extends Error {}
export async function readDecision(id:string,sequence:number):Promise<ReviewDetail>{
 const response=await fetch(`/api/admin/review/${encodeURIComponent(id)}/decision`,{cache:'no-store',signal:AbortSignal.timeout(15000)});const value=await response.json();
 if(!response.ok)throw new Error(value.error??'READ_FAILED');
 const article=recoverySnapshot(value.article,id,sequence);const review=value.review;
 if(typeof value.canDecide!=='boolean'||review===undefined)throw new Error('READ_FAILED');
 if(review!==null&&(!Number.isSafeInteger(review.revision)||review.revision<1||typeof review.submittedBy!=='string'||!review.submittedBy||typeof review.reviewerId!=='string'||!review.reviewerId||typeof review.reviewerName!=='string'||!['in_review','withdrawn','rejected','approved'].includes(review.status)||!(review.reason===null||typeof review.reason==='string')||typeof review.submittedAt!=='string'||!(review.decidedAt===null||typeof review.decidedAt==='string')))throw new Error('READ_FAILED');
 if(value.canDecide&&(article.status!=='in_review'||article.lifecycle!=='active'||!review||review.status!=='in_review'))throw new Error('READ_FAILED');
 return {article,review,canDecide:value.canDecide};
}
export async function sendDecision(id:string,input:DecisionInput,revision:number,reviewerId:string):Promise<DecisionAck>{
 const response=await fetch(`/api/admin/review/${encodeURIComponent(id)}/decision`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(20000)});const value=await response.json();
 if(!response.ok){if(response.status>=400&&response.status<500)throw new DecisionRejected(value.error??'REJECTED');throw new Error('UNKNOWN_RESULT');}
 if(value.documentId!==id||value.sequence!==input.expectedSequence+1||value.revision!==revision||value.reviewerId!==reviewerId||value.action!==input.action||value.status!==(input.action==='approve'?'approved':'changes_requested')||value.reason!==(input.action==='reject'?input.reason:null))throw new Error('INVALID_ACK');
 return value;
}
export function decisionError(error:unknown,reading=false){const code=error instanceof Error?error.message:'';
 if(reading)return code==='FORBIDDEN'?'当前账号没有管理权限，无法读取二审详情。':'未能读取最新二审状态，已暂停决定。原内容和输入仍保留，请重新读取。';
 return code==='CONFLICT'?'文章版本已改变。原输入仍保留，请重新读取二审状态，核对后再决定。':['FORBIDDEN','NOT_REVIEWER'].includes(code)?'当前账号不是本次指定的可用二审管理员，不能操作。请重新读取二审状态。':code==='REASON_REQUIRED'?'请填写退回原因，再核对当前二审状态。':['INVALID_STATE','INACTIVE_DOCUMENT','NOT_FOUND'].includes(code)?'文章或二审状态已改变，请重新读取二审状态。':'决定结果尚未确认。原操作与原因已保留；请重试原决定完成核对。';
}
