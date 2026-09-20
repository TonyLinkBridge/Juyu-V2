'use client';
import {confirmAction} from '../feedback/feedback';
import {useState,type Ref} from 'react';
import type {EditorData} from '../../editor/contract';
import {recoverySnapshot,recoveryReadable} from '../../editor/recovery';
import {statuses,kinds} from '../../workspace/model';
export function InputBackup({value,label='当前输入备份'}:{value:string;label?:string}){
 const [message,setMessage]=useState('');
 return <details className="editor-input-backup"><summary>{label}</summary><p>完整输入保留在此页面内。关闭或刷新页面后不会保留，请按需复制。</p><textarea aria-label={label} value={value} readOnly rows={8} spellCheck={false}/><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(value);setMessage('备份已复制。');}catch{setMessage('复制未成功，请选中上方文字手动复制。');}}}>复制这份备份</button>{message&&<p role="status">{message}</p>}</details>;
}
export function EditorRecovery({documentId,sequence,busy,copy,onLoad,readButtonRef}:{readButtonRef?:Ref<HTMLButtonElement>;documentId:string;sequence:number|null;busy:boolean;copy:string;onLoad:(data:EditorData)=>void}){
 const [latest,setLatest]=useState<EditorData|null>(null);const [loading,setLoading]=useState(false);const [error,setError]=useState('');
 async function readLatest(){if(loading||busy)return;setLoading(true);setLatest(null);setError('');try{
  const response=await fetch(`/api/admin/editor/${encodeURIComponent(documentId)}`,{cache:'no-store',signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(response.status===403?'FORBIDDEN':response.status===404?'NOT_FOUND':'UNAVAILABLE');
  setLatest(recoverySnapshot(await response.json(),documentId,sequence));
 }catch(e){setError(e instanceof Error&&e.message==='FORBIDDEN'?'当前账号没有管理权限，不能读取服务器内容。':e instanceof Error&&e.message==='NOT_FOUND'?'服务器上尚未找到这篇资料，请保留输入并核对保存结果。':'最新版本未读取成功，当前输入仍保留，请重试。');}finally{setLoading(false);}}
 return <section className="editor-recovery" aria-label="保存恢复"><h2>先保留输入，再处理保存问题</h2><p>读取最新版本只用于对照，不会修改你的输入或服务器资料。若其他人再次修改，后续保存仍会核对版本。</p><InputBackup value={copy}/><button ref={readButtonRef} type="button" disabled={busy||loading} onClick={()=>void readLatest()}>{loading?'正在读取最新版本…':'读取服务器最新版本'}</button>{error&&<p role="alert">{error}</p>}
 {latest&&<section className="editor-server-copy" aria-label="服务器版本"><h3>{latest.title}</h3><p>服务器版本 {latest.sequence} · {statuses.find(s=>s.id===latest.status)?.name} · {kinds[latest.kind]} · {latest.audience==='staff'?'普通员工':latest.audience==='ops'?'Ops 与 Admin':'仅 Admin'}</p><p>标签：{latest.tags.join('、')||'无'}；封面：{latest.cover?.alt|| (latest.cover?'已设置':'无')}</p>{latest.kind==='qa'&&<p>问答分类：{latest.qa?.category||'未分类'}；问答排序：{latest.qa?.position??0}</p>}<p>以下是已读取的服务器内容；图片和文件仅显示说明。</p><div className="editor-server-body"><pre>{recoveryReadable(latest)}</pre></div><button type="button" disabled={busy||loading} onClick={async()=>{if(await confirmAction('载入服务器版本后，当前输入会保留为页面内备份，编辑区将使用服务器内容。确定继续？'))onLoad(recoverySnapshot(latest,documentId,sequence));}}>保留备份并载入此版本</button></section>}
 </section>;
}
