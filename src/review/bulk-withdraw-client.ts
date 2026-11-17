import {workspaceHref,workspaceQuery,statuses,kinds,type WorkspaceData,type WorkspaceQuery} from '../workspace/model.ts';
import {bulkWithdrawInput,type BulkWithdrawInput,type BulkWithdrawResult} from './bulk-withdraw.ts';
export class BulkWithdrawRejected extends Error {}
const record=(x:unknown):x is Record<string,unknown>=>Boolean(x)&&typeof x==='object'&&!Array.isArray(x);
export async function sendBulkWithdraw(input:BulkWithdrawInput):Promise<BulkWithdrawResult>{
 const exact=bulkWithdrawInput(input);const response=await fetch('/api/admin/review/bulk-withdraw',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(exact),signal:AbortSignal.timeout(45000)});let value:unknown;
 try{value=await response.json();}catch{throw new Error('UNKNOWN_RESULT');}
 if(!response.ok){if(response.status>=400&&response.status<500&&record(value)&&typeof value.error==='string')throw new BulkWithdrawRejected(value.error);throw new Error('UNKNOWN_RESULT');}
 if(!record(value)||!Array.isArray(value.items)||value.items.length!==exact.items.length)throw new Error('UNKNOWN_RESULT');
 for(let i=0;i<exact.items.length;i++){const item=exact.items[i],ack=value.items[i];if(!record(ack)||ack.documentId!==item.documentId||ack.sequence!==item.expectedSequence+1||ack.revision!==item.revision||ack.publishedRevision!==item.publishedRevision||ack.action!=='withdraw'||ack.status!=='draft'||typeof ack.previousReviewerId!=='string'||!ack.previousReviewerId.trim()||ack.reviewerId!==null)throw new Error('UNKNOWN_RESULT');}
 return value as unknown as BulkWithdrawResult;
}
export function bulkWithdrawError(error:unknown){
 return error instanceof BulkWithdrawRejected?error.message==='CONFLICT'||error.message==='INVALID_STATE'?'所选资料的版本或审核状态已改变，整批未执行。请重新读取列表，再勾选核对。':error.message==='FORBIDDEN'?'当前账号没有撤回权限，整批未执行。请核对账号权限。':'整批未执行。请重新读取列表，核对后再操作。':'本次批量操作结果尚未确认。原批次已保留，请重试原批次核对，避免重复处理。';
}

export async function readWithdrawWorkspace(query:WorkspaceQuery,completed:BulkWithdrawResult['items']=[]):Promise<WorkspaceData>{
 const response=await fetch('/api/admin/workspace'+workspaceHref(query).slice('/admin'.length),{cache:'no-store',signal:AbortSignal.timeout(15000)});const value:unknown=await response.json();
 const integer=(n:unknown,min=0)=>Number.isSafeInteger(n)&&Number(n)>=min;
 if(!response.ok||!record(value)||!record(value.query)||!record(value.counts)||!Array.isArray(value.items)||value.items.length>30||!integer(value.total)||!integer(value.page,1)||!integer(value.pages,1))throw new Error('READ_FAILED');
 if(value.canBulkWithdraw!==undefined&&typeof value.canBulkWithdraw!=='boolean')throw new Error('READ_FAILED');
 if(!integer(value.query.page,1))throw new Error('READ_FAILED');
 let actual:WorkspaceQuery;try{actual=workspaceQuery({...value.query,page:String(value.query.page)} as Record<string,string>);}catch{throw new Error('READ_FAILED');}
 // workspaceQuery accepts HTTP strings; response fields use typed page numbers.
 for(const key of ['q','scope','kind','status','view'] as const)if(actual[key]!==query[key])throw new Error('READ_FAILED');
 const counts=value.counts;
 if(statuses.some(s=>!integer(counts[s.id]))||value.pages!==Math.max(1,Math.ceil(Number(value.total)/30))||value.page!==Math.min(query.page,Number(value.pages))||actual.page!==value.page||value.items.length!==Math.min(30,Math.max(0,Number(value.total)-(Number(value.page)-1)*30)))throw new Error('READ_FAILED');
 const total=query.status==='all'?statuses.reduce((n,s)=>n+Number(counts[s.id]),0):counts[query.status];if(total!==value.total)throw new Error('READ_FAILED');
 const seen=new Set<string>();for(const row of value.items){if(!record(row)||typeof row.id!=='string'||!row.id||seen.has(row.id)||typeof row.title!=='string'||typeof row.kind!=='string'||!Object.hasOwn(kinds,row.kind)||!statuses.some(s=>s.id===row.status)||!integer(row.sequence)||!integer(row.revision,1)||!(row.publishedRevision===null||integer(row.publishedRevision,1))||typeof row.updatedAt!=='string'||!Number.isFinite(Date.parse(row.updatedAt))||typeof row.author!=='string'||typeof row.editor!=='string'||!(row.submitter===null||typeof row.submitter==='string')||!(row.reviewer===null||typeof row.reviewer==='string')||row.canWithdrawSubmission!==undefined&&typeof row.canWithdrawSubmission!=='boolean'||['categoryPaths','publishedCategoryPaths'].some(key=>row[key]!==undefined&&(!Array.isArray(row[key])||row[key].some((x:unknown)=>typeof x!=='string'))))throw new Error('READ_FAILED');
  const ack=completed.find(a=>a.documentId===row.id);if(ack&&(Number(row.sequence)<ack.sequence||row.sequence===ack.sequence&&row.status!=='draft'))throw new Error('READ_FAILED');seen.add(row.id);
 }
 return value as unknown as WorkspaceData;
}
