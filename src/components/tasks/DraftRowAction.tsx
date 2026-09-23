'use client';
import {useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {lifecycleError,lifecycleRequest} from '../../lifecycle/client';
import {discardDraftRequest,draftActionError} from '../../drafts/client';

export function DraftRowAction({id,title,sequence,publishedRevision,onCompleted}:{id:string;title:string;sequence:number;publishedRevision:number|null;onCompleted:(action:'trash'|'discard',sequence:number)=>void}){
 const dialog=useRef<HTMLDialogElement>(null);const router=useRouter();
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const action=publishedRevision===null?'trash':'discard';
 const label=action==='trash'?'删除草稿':'放弃本次修订';
 async function confirm(){if(busy)return;setBusy(true);setError('');try{const result=action==='trash'?await lifecycleRequest(id,{action:'trash',expectedSequence:sequence}):await discardDraftRequest(id,{expectedSequence:sequence});dialog.current?.close();onCompleted(action,result.sequence);router.refresh();}catch(e){setError(action==='trash'?lifecycleError(e):draftActionError(e));}finally{setBusy(false);}}
 return <>
  <button type="button" className="task-draft-trigger" disabled={busy} onClick={()=>{setError('');dialog.current?.showModal();}}>{label}</button>
  <dialog ref={dialog} className="juyu-confirm task-draft-dialog" aria-labelledby={`draft-action-${id}`} onCancel={event=>{if(busy)event.preventDefault();}}>
   <h2 id={`draft-action-${id}`}>{action==='trash'?'删除这篇草稿？':'放弃本次修订？'}</h2>
   <p className="trash-document-name">{title}</p>
   {action==='trash'?<><p>这篇资料从未发布。确认后会移入回收站，不会出现在员工资料库中。</p><p>之后仍可从回收站恢复为未发布草稿。</p></>:<><p>当前尚未发布的修改会被放弃，并保留在历史记录中。</p><p>员工正在阅读的正式版本 {publishedRevision} 会继续上线，不受影响。</p></>}
   {error&&<p role="alert" className="task-draft-error">{error}</p>}
   <div className="juyu-confirm-actions"><button type="button" disabled={busy} onClick={()=>dialog.current?.close()}>取消</button><button type="button" className="editor-delete-trigger" disabled={busy} onClick={()=>void confirm()}>{busy?'正在处理…':action==='trash'?'确认删除草稿':'确认放弃修订'}</button></div>
  </dialog>
 </>;
}
