'use client';
import {confirmAction} from '../feedback/feedback';
import {useState,type Ref} from 'react';
import type {EditorData} from '../../editor/contract';
import {recoverySnapshot,recoveryReadable} from '../../editor/recovery';
import {statuses,kinds} from '../../workspace/model';
export function InputBackup({value,label,locale='zh-CN'}:{value:string;label?:string;locale?:'zh-CN'|'en'}){
 const [message,setMessage]=useState('');
 const t=(zh:string,en:string)=>locale==='en'?en:zh;const title=label??t('当前输入备份','Current input backup');
 return <details className="editor-input-backup"><summary>{title}</summary><p>{t('完整输入保留在此页面内。关闭或刷新页面后不会保留，请按需复制。','Your current input stays on this page only. Copy it before closing or refreshing.')}</p><textarea aria-label={title} value={value} readOnly rows={8} spellCheck={false}/><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(value);setMessage(t('备份已复制。','Backup copied.'));}catch{setMessage(t('复制未成功，请选中上方文字手动复制。','Could not copy it. Select the text above and copy it manually.'));}}}>{t('复制这份备份','Copy this backup')}</button>{message&&<p role="status">{message}</p>}</details>;
}
export function EditorRecovery({documentId,sequence,busy,copy,onLoad,readButtonRef,locale='zh-CN'}:{readButtonRef?:Ref<HTMLButtonElement>;documentId:string;sequence:number|null;busy:boolean;copy:string;locale?:'zh-CN'|'en';onLoad:(data:EditorData)=>void}){
 const [latest,setLatest]=useState<EditorData|null>(null);const [loading,setLoading]=useState(false);const [error,setError]=useState('');
 const t=(zh:string,en:string)=>locale==='en'?en:zh;
 async function readLatest(){if(loading||busy)return;setLoading(true);setLatest(null);setError('');try{
  const response=await fetch(`/api/admin/editor/${encodeURIComponent(documentId)}`,{cache:'no-store',signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(response.status===403?'FORBIDDEN':response.status===404?'NOT_FOUND':'UNAVAILABLE');
  setLatest(recoverySnapshot(await response.json(),documentId,sequence));
 }catch(e){setError(e instanceof Error&&e.message==='FORBIDDEN'?t('当前账号没有管理权限，不能读取服务器内容。','This account cannot read the server copy.'):e instanceof Error&&e.message==='NOT_FOUND'?t('服务器上尚未找到这篇资料，请保留输入并核对保存结果。','This article is not on the server yet. Keep your input and check whether the save succeeded.'):t('最新版本未读取成功，当前输入仍保留，请重试。','Could not load the latest version. Your input is still here; please try again.'));}finally{setLoading(false);}}
 return <section className="editor-recovery" aria-label={t('保存恢复','Save recovery')}><h2>{t('先保留输入，再处理保存问题','Keep your input before resolving the save issue')}</h2><p>{t('读取最新版本只用于对照，不会修改你的输入或服务器资料。若其他人再次修改，后续保存仍会核对版本。','Loading the latest version lets you compare changes. It will not change your input or the server copy. Any later save still checks for newer changes.')}</p><InputBackup value={copy} locale={locale}/><button ref={readButtonRef} type="button" disabled={busy||loading} onClick={()=>void readLatest()}>{loading?t('正在读取最新版本…','Loading the latest version…'):t('读取服务器最新版本','Load the latest server version')}</button>{error&&<p role="alert">{error}</p>}
 {latest&&<section className="editor-server-copy" aria-label={t('服务器版本','Server version')}><h3>{latest.title}</h3><p>{t('服务器版本','Server version')} {latest.sequence} · {locale==='en'?latest.status.replaceAll('_',' '):statuses.find(s=>s.id===latest.status)?.name} · {locale==='en'?latest.kind:kinds[latest.kind]} · {locale==='en'?{staff:'All staff',ops:'Ops and Admin',admin:'Admin only'}[latest.audience]:latest.audience==='staff'?'普通员工':latest.audience==='ops'?'Ops 与 Admin':'仅 Admin'}</p><p>{t('标签：','Tags: ')}{latest.tags.join(locale==='en'?', ':'、')||t('无','None')}{t('；封面：','; cover: ')}{latest.cover?.alt|| (latest.cover?t('已设置','Set'):t('无','None'))}</p>{latest.kind==='qa'&&<p>{t('问答分类：','Q&A category: ')}{latest.qa?.category||t('未分类','Uncategorized')}{t('；问答排序：','; Q&A order: ')}{latest.qa?.position??0}</p>}<p>{t('以下是已读取的服务器内容；图片和文件仅显示说明。','This is the server copy. Images and files appear as descriptions only.')}</p><div className="editor-server-body"><pre>{recoveryReadable(latest)}</pre></div><button type="button" disabled={busy||loading} onClick={async()=>{if(await confirmAction(t('载入服务器版本后，当前输入会保留为页面内备份，编辑区将使用服务器内容。确定继续？','Load the server copy into the editor? Your current input will remain in an on-page backup.')))onLoad(recoverySnapshot(latest,documentId,sequence));}}>{t('保留备份并载入此版本','Keep a backup and load this version')}</button></section>}
 </section>;
}
