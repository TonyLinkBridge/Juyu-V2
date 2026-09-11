'use client';
import {useRef,useState} from 'react';
import {lifecycleRequest,lifecycleError} from '../../lifecycle/client';
export function DocumentTrashAction({id,title,sequence,disabled,onBusy,onDeleted}:{id:string;title:string;sequence:number;disabled:boolean;onBusy:(busy:boolean)=>void;onDeleted:(sequence:number)=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [confirmation,setConfirmation]=useState<{title:string;sequence:number}|null>(null);
 const [typed,setTyped]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [done,setDone]=useState(false);
 const matches=Boolean(confirmation&&confirmation.title&&typed===confirmation.title&&title===confirmation.title&&sequence===confirmation.sequence);
 async function trash(){if(disabled||busy||!matches||!confirmation)return;setBusy(true);onBusy(true);setError('');try{const result=await lifecycleRequest(id,{action:'trash',expectedSequence:confirmation.sequence});setDone(true);dialog.current?.close();onDeleted(result.sequence);}catch(e){setError(lifecycleError(e));}finally{setBusy(false);onBusy(false);}}
 return <section className="document-trash-action" aria-label="文章删除">{done?<p role="status">文章已移入回收站，员工无法再读取。<a href="/admin/trash">打开回收站</a></p>:<><button className="editor-delete-trigger" type="button" disabled={disabled||busy} onClick={()=>{setConfirmation({title,sequence});setTyped('');setError('');dialog.current?.showModal();}}>删除文章</button><p>移入回收站后，可恢复为未发布草稿。请先保存修改。</p></>}
 <dialog ref={dialog} className="juyu-confirm editor-trash-dialog" aria-labelledby="trash-title" aria-describedby="trash-description" onCancel={e=>{if(busy)e.preventDefault();}}>
 <h2 id="trash-title">将文章移入回收站？</h2><p className="trash-document-name">{confirmation?.title}</p>
 <p id="trash-description">文章会立即下线，员工无法通过目录、搜索、附件或 PDF 继续读取。正在进行的审核会结束。</p>
 <p>文章保留在回收站，可以恢复为未发布草稿。</p>
 <label>请输入上方完整文章标题以确认<input autoFocus autoComplete="off" value={typed} disabled={busy} onChange={e=>setTyped(e.target.value)}/></label>
 {confirmation&&(sequence!==confirmation.sequence||title!==confirmation.title)&&<p role="alert">文章已更新，请取消并重新打开确认窗口。</p>}
 {error&&<p role="alert">{error}</p>}
 <div className="trash-dialog-actions"><button type="button" disabled={busy} onClick={()=>dialog.current?.close()}>取消</button><button className="editor-delete-trigger" type="button" disabled={disabled||busy||!matches} onClick={()=>void trash()}>{busy?'正在移入…':'移入回收站'}</button></div>
 </dialog></section>;
}
