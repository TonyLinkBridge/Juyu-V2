'use client';
import {useState} from 'react';
import {lifecycleRequest,lifecycleError} from '../../lifecycle/client';
export function DocumentTrashAction({id,title,sequence,disabled,onBusy,onDeleted}:{id:string;title:string;sequence:number;disabled:boolean;onBusy:(busy:boolean)=>void;onDeleted:(sequence:number)=>void}){
 const [confirming,setConfirming]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [done,setDone]=useState(false);
 async function trash(){if(disabled||busy)return;setBusy(true);onBusy(true);setError('');try{const result=await lifecycleRequest(id,{action:'trash',expectedSequence:sequence});setDone(true);setConfirming(false);onDeleted(result.sequence);}catch(e){setError(lifecycleError(e));}finally{setBusy(false);onBusy(false);}}
 return <section className="document-trash-action" aria-label="文章删除">{done?<p role="status">文章已移入回收站，员工无法再读取。<a href="/admin/trash">打开回收站</a></p>:<><button type="button" disabled={disabled||busy} onClick={()=>setConfirming(true)}>删除文章</button><p>先保存当前修改。删除后进入回收站，可恢复为未发布草稿。</p>{confirming&&<div className="lifecycle-confirm" role="group" aria-label="确认移入回收站"><h3>删除“{title}”？</h3><p>文章会立即下线，员工将无法通过目录、搜索、附件或PDF继续读取。正在进行的审核会结束。</p><button type="button" disabled={disabled||busy} onClick={()=>void trash()}>{busy?'正在处理…':'确认移入回收站'}</button><button type="button" disabled={busy} onClick={()=>setConfirming(false)}>取消删除</button></div>}{error&&<p role="alert">{error}</p>}</>}
 </section>;
}
