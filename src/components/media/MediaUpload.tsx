'use client';
import {useEffect,useRef,useState} from 'react';
import {X,UploadSimple} from '@phosphor-icons/react';
import type {UploadTargets} from '../../media/library';
import {uploadExtensions} from '../../media/model';
export function MediaUpload({initialArticle,onClose,onUploaded}:{initialArticle?:{id:string;title:string};onClose:()=>void;onUploaded:(assetId:string)=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [search,setSearch]=useState(''),[page,setPage]=useState(1),[targets,setTargets]=useState<UploadTargets|null>(null),[target,setTarget]=useState(initialArticle??null),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[retry,setRetry]=useState(0),[failed,setFailed]=useState(false);
 useEffect(()=>{const element=dialog.current;element?.showModal();return()=>element?.close();},[]);
 useEffect(()=>{const controller=new AbortController();let active=true;const timer=setTimeout(()=>{
  void fetch(`/api/admin/media/targets?q=${encodeURIComponent(search)}&page=${page}`,{cache:'no-store',credentials:'same-origin',signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error();const data=await response.json() as UploadTargets;if(active){setTargets(data);setFailed(false);}}).catch(()=>{if(active)setFailed(true);});
 },200);return()=>{active=false;clearTimeout(timer);controller.abort();};},[search,page,retry]);
 async function upload(){
  if(!file||!target||busy)return;const extension=file.name.split('.').at(-1)?.toLowerCase()??'',rule=uploadExtensions[extension];
  if(!rule){setMessage('此文件类型暂不支持，请选择图片、视频、音频、PDF、TXT 或 CSV。');return;}
  if(file.size===0||file.size>rule.max*1024*1024){setMessage(`文件为空或超过限制：此类型最多 ${rule.max} MB。`);return;}
  setBusy(true);setMessage('正在上传并验证文件，请保持此窗口打开…');
  try{const response=await fetch(`/api/admin/media/${encodeURIComponent(target.id)}/upload`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent(file.name)},body:file,signal:AbortSignal.timeout(120000)});const result=await response.json();if(!response.ok||result.status!=='ready'||typeof result.id!=='string')throw new Error(result.error??'UNCONFIRMED');setMessage('上传成功，正在刷新文件列表。');onUploaded(result.id);}
  catch(error){const code=error instanceof Error?error.message:'';setMessage(code==='INVALID_STATE'?'文章已进入审核，暂时不能上传。请选择其他可编辑文章。':code==='INVALID_UPLOAD'?'文件内容与扩展名不符，或类型不支持。':code==='UPLOAD_TOO_LARGE'?'文件超过该类型的大小限制。':'上传结果未确认。请先关闭窗口并刷新文件列表，确认是否已上传，再重试。');setBusy(false);}
 }
 return <dialog ref={dialog} className="admin-data-upload" aria-labelledby="media-upload-title" onCancel={event=>{event.preventDefault();if(!busy)onClose();}}><header><div><h2 id="media-upload-title">上传文件</h2><p>选择文件所属的文章，上传后可在编辑器中插入。</p></div><button aria-label="关闭上传窗口" disabled={busy} onClick={onClose}><X size={20}/></button></header><div className="admin-data-upload-body">
 <label>查找文章<input disabled={busy} value={search} maxLength={120} placeholder="输入文章标题" onChange={event=>{setSearch(event.target.value);setPage(1);setTargets(null);}}/></label>
 {target&&<p className="admin-data-upload-selected">已选择：<strong>{target.title}</strong></p>}
 <div className="admin-data-upload-targets" aria-label="选择文件所属文章">{failed?<p role="alert">文章列表暂时无法读取。<button onClick={()=>{setFailed(false);setTargets(null);setRetry(x=>x+1);}}>重新读取</button></p>:!targets?<p role="status">正在查找文章…</p>:targets.items.length?targets.items.map(item=><label key={item.id}><input type="radio" name="upload-article" checked={target?.id===item.id} disabled={busy} onChange={()=>setTarget(item)}/><span>{item.title}</span></label>):<p>没有找到可编辑文章。审核中的文章暂时不能上传。</p>}</div>
 {targets&&<div className="admin-data-pagination"><button disabled={busy||targets.page<=1} onClick={()=>{setTargets(null);setPage(targets.page-1);}}>上一页</button><span>第 {targets.page} / {targets.pages} 页</span><button disabled={busy||targets.page>=targets.pages} onClick={()=>{setTargets(null);setPage(targets.page+1);}}>下一页</button></div>}
 <label>选择文件<input type="file" disabled={busy} accept=".png,.jpg,.jpeg,.gif,.webp,.mp4,.webm,.mp3,.ogg,.pdf,.txt,.csv" onChange={event=>{setFile(event.target.files?.[0]??null);setMessage('');}}/></label><p className="admin-data-caption">图片、TXT、CSV 最多 5 MB；音频和 PDF 最多 20 MB；视频最多 50 MB。上传不会直接改变已发布文章。</p>{message&&<p role="status">{message}</p>}</div><footer><button disabled={busy} onClick={onClose}>取消</button><button className="admin-data-primary-button" disabled={busy||!file||!target} onClick={()=>void upload()}><UploadSimple size={16}/>{busy?'正在上传…':'上传文件'}</button></footer></dialog>;
}
