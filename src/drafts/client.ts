import type {DraftActionInput,DraftActionResult} from './model';
export async function discardDraftRequest(id:string,input:DraftActionInput):Promise<DraftActionResult>{
 const response=await fetch(`/api/admin/drafts/${encodeURIComponent(id)}/discard`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(45000)});const value=await response.json();
 if(!response.ok)throw new Error(value.error??'DRAFT_ACTION_UNAVAILABLE');
 if(value.documentId!==id||value.sequence!==input.expectedSequence+1||value.status!=='published'||!Number.isSafeInteger(value.revision)||value.revision<1||value.publishedRevision!==value.revision)throw new Error('INVALID_ACK');
 return value;
}
export function draftActionError(error:unknown){const code=error instanceof Error?error.message:'';return code==='UPLOAD_IN_PROGRESS'?'文件仍在上传，请等上传明确结束后再放弃修订。':code==='CONFLICT'?'这篇资料已被更新，请重新读取后再操作。':code==='FORBIDDEN'?'当前账号没有此操作权限。':code==='INVALID_STATE'||code==='NOT_FOUND'?'这篇资料已不是可以放弃的草稿，请重新读取列表。':code==='INVALID_INPUT'?'操作资料不完整，请重新读取列表。':'操作结果尚未确认，请重新读取列表核对，避免重复操作。';}
