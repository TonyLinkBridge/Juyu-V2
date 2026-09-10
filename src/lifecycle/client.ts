import type {LifecycleCommand,LifecycleResult} from './model';
export async function lifecycleRequest(id:string,input:LifecycleCommand):Promise<LifecycleResult>{
 const r=await fetch(`/api/admin/lifecycle/${encodeURIComponent(id)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(45000)});const v=await r.json();
 if(!r.ok)throw new Error(v.error??'LIFECYCLE_UNAVAILABLE');
 if(v.documentId!==id||v.action!==input.action||v.sequence!==input.expectedSequence+1||!Number.isSafeInteger(v.cleanupPending)||v.cleanupPending<0)throw new Error('INVALID_ACK');
 return v;
}
export function lifecycleError(error:unknown){const code=error instanceof Error?error.message:'';return code==='UPLOAD_IN_PROGRESS'?'文件仍在上传，请等上传明确结束后再删除。':code==='CONFLICT'?'这篇资料已被更新，请重新读取后再操作。':code==='FORBIDDEN'?'当前账号没有此操作权限。':code==='CONFIRMATION_REQUIRED'||code==='INVALID_INPUT'?'确认内容不正确，请核对后再试。':code==='INVALID_STATE'||code==='NOT_FOUND'?'资料状态已改变或不存在，请重新读取。':'操作结果尚未确认，请重新读取列表核对，避免重复操作。';}
