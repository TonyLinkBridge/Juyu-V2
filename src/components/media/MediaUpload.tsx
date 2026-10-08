'use client';
import {useEffect,useRef,useState} from 'react';
import {X} from '@phosphor-icons/react';
import type {UploadTargets} from '../../media/library';
import {MediaUploadError,uploadMediaFile,validateMediaFile} from '../../media/upload-client';
import {FileDropzone,type FileDropzoneItem} from '../ui/arc/file-dropzone/file-dropzone';
import {ActionButton} from '../ui/arc/action-button/action-button';
import {ArcScope} from '../ui/arc/ArcScope';
export function MediaUpload({initialArticle,onClose,onUploaded}:{initialArticle?:{id:string;title:string};onClose:()=>void;onUploaded:(assetId:string)=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [search,setSearch]=useState(''),[page,setPage]=useState(1),[targets,setTargets]=useState<UploadTargets|null>(null),[target,setTarget]=useState(initialArticle??null),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[retry,setRetry]=useState(0),[failed,setFailed]=useState(false);
 useEffect(()=>{const element=dialog.current;element?.showModal();return()=>element?.close();},[]);
 useEffect(()=>{const controller=new AbortController();let active=true;const timer=setTimeout(()=>{
  void fetch(`/api/admin/media/targets?q=${encodeURIComponent(search)}&page=${page}`,{cache:'no-store',credentials:'same-origin',signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error();const data=await response.json() as UploadTargets;if(active){setTargets(data);setFailed(false);}}).catch(()=>{if(active)setFailed(true);});
 },200);return()=>{active=false;clearTimeout(timer);controller.abort();};},[search,page,retry]);
 const [fileState,setFileState]=useState<Partial<FileDropzoneItem>>({}),[unconfirmed,setUnconfirmed]=useState(false),[receipt,setReceipt]=useState<string|null>(null);
 const uploadLock=useRef(false);
 async function upload(){
  if(!file||!target||uploadLock.current||unconfirmed)throw new Error('请选择文章与文件后再上传。');
  validateMediaFile(file);uploadLock.current=true;setBusy(true);setMessage('正在上传并验证文件，请保持此窗口打开…');setFileState({status:'uploading',progress:0});
  try{const id=await uploadMediaFile(target.id,file,{onProgress:progress=>setFileState({status:'uploading',progress})});setFileState({status:'uploaded',progress:100});setReceipt(id);setMessage('上传成功。点击完成查看文件详情。');}
  catch(error){const failure=error instanceof MediaUploadError?error:new MediaUploadError('上传结果未确认。请刷新文件列表后确认。');setFileState({status:'failed',error:failure.message,retryable:failure.retryable});setUnconfirmed(!failure.retryable);setMessage(failure.message);throw failure;}
  finally{uploadLock.current=false;setBusy(false);}
 }
 function chooseFiles(files:File[]){const next=files[0]??null;setFile(next);setFileState({});setMessage('');setUnconfirmed(false);if(next)try{validateMediaFile(next);}catch(error){const text=error instanceof Error?error.message:'文件不正确';setFile(null);setFileState({status:'failed',error:text,retryable:false});setMessage(text);}}
 return <dialog ref={dialog} className="admin-data-upload" aria-labelledby="media-upload-title" onCancel={event=>{event.preventDefault();if(!busy)onClose();}}><header><div><h2 id="media-upload-title">上传文件</h2><p>选择文件所属的文章，上传后可在编辑器中插入。</p></div><button aria-label="关闭上传窗口" disabled={busy||!!receipt} onClick={onClose}><X size={20}/></button></header><div className="admin-data-upload-body">
 <label>查找文章<input disabled={busy||!!receipt} value={search} maxLength={120} placeholder="输入文章标题" onChange={event=>{setSearch(event.target.value);setPage(1);setTargets(null);}}/></label>
 {target&&<p className="admin-data-upload-selected">已选择：<strong>{target.title}</strong></p>}
 <div className="admin-data-upload-targets" aria-label="选择文件所属文章">{failed?<p role="alert">文章列表暂时无法读取。<button onClick={()=>{setFailed(false);setTargets(null);setRetry(x=>x+1);}}>重新读取</button></p>:!targets?<p role="status">正在查找文章…</p>:targets.items.length?targets.items.map(item=><label key={item.id}><input type="radio" name="upload-article" checked={target?.id===item.id} disabled={busy||!!receipt} onChange={()=>setTarget(item)}/><span>{item.title}</span></label>):<p>没有找到可编辑文章。审核中的文章暂时不能上传。</p>}</div>
 {targets&&<div className="admin-data-pagination"><button disabled={busy||!!receipt||targets.page<=1} onClick={()=>{setTargets(null);setPage(targets.page-1);}}>上一页</button><span>第 {targets.page} / {targets.pages} 页</span><button disabled={busy||!!receipt||targets.page>=targets.pages} onClick={()=>{setTargets(null);setPage(targets.page+1);}}>下一页</button></div>}
 <ArcScope><FileDropzone multiple={false} maxFiles={1} compactAt={1} label="选择文件或拖放到这里" description="先选择文章，再确认上传。支持拖放与粘贴图片。" note="图片、TXT、CSV ≤ 5 MB · 音频、PDF ≤ 20 MB · 视频 ≤ 50 MB" dropLabel="放开以选择文件" accept=".png,.jpg,.jpeg,.gif,.webp,.mp4,.webm,.mp3,.ogg,.pdf,.txt,.csv" disabled={busy||!!receipt||unconfirmed} onFilesChange={chooseFiles} itemState={fileState} onRetry={()=>void upload().catch(()=>{})}/></ArcScope><p className="admin-data-caption">上传不会直接改变已发布文章。传输完成后，系统还会验证文件。</p>{message&&<p role="status">{message}</p>}</div><footer><button disabled={busy||!!receipt} onClick={onClose}>{receipt?'关闭':'取消'}</button>{receipt?<button className="admin-data-primary-button" onClick={()=>onUploaded(receipt)}>完成，查看文件</button>:<ArcScope><ActionButton aria-label="上传文件" label="上传文件" pendingLabel="正在上传…" successLabel="上传成功" disabled={busy||!file||!target||unconfirmed} onAction={upload} onActionError={error=>setMessage(error instanceof Error?error.message:'上传失败，请重新选择。')}/></ArcScope>}</footer></dialog>;
}
