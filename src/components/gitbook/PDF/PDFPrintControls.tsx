'use client';
import {useEffect,useRef,useState} from 'react';
import {PrintButton} from './PrintButton';
// Adapted from GitBook print controls and image-loading feedback; JUYU adds
// confirmed server download with explicit failure recovery.
export function PDFPrintControls({documentId,revision,coverId}:{documentId:string;revision:number;coverId:string|null}){
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [ready,setReady]=useState(false);const [imageError,setImageError]=useState(false);const request=useRef<AbortController|null>(null);
 useEffect(()=>{
  let cancelled=false;
  const images=[...document.querySelectorAll<HTMLImageElement>('.pdf-paper img')];
  const handlers:{img:HTMLImageElement;done:()=>void}[]=[];
  void Promise.all(images.map(img=>new Promise<void>(resolve=>{if(img.complete)return resolve();const done=()=>resolve();handlers.push({img,done});img.addEventListener('load',done,{once:true});img.addEventListener('error',done,{once:true});}))).then(()=>{if(!cancelled){setImageError(images.some(img=>img.naturalWidth===0));setReady(true);}});
  return()=>{cancelled=true;for(const {img,done} of handlers){img.removeEventListener('load',done);img.removeEventListener('error',done);}request.current?.abort();};
 },[]);
 async function download(){
  if(busy)return;setBusy(true);setMessage('');const controller=new AbortController();request.current=controller;const timer=setTimeout(()=>controller.abort(),45000);
  try{
   const response=await fetch(`/api/articles/${encodeURIComponent(documentId)}/pdf?revision=${revision}&download=1`,{cache:'no-store',signal:controller.signal});
   if(!response.ok){const data=await response.json();setMessage(data.error==='VERSION_CHANGED'?'文章已更新，请返回文章重新打开 PDF。':data.error==='NOT_FOUND'||data.error==='FORBIDDEN'?'文章已下线或访问权限已变化，请返回资料库。':data.error==='PDF_TOO_LARGE'?'内容超过本次导出范围，请联系管理员拆分文章或压缩封面。':data.error==='PDF_BUSY'?'正在处理另一份 PDF，请稍后重试。':'PDF 暂时无法生成，请稍后重试。');return;}
   if(response.headers.get('content-type')!=='application/pdf')throw new Error('INVALID_PDF');
   const blob=await response.blob();const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`article-v${revision}.pdf`;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);setMessage('PDF 已生成，已交给浏览器下载。');
  }catch{if(!controller.signal.aborted||request.current===controller)setMessage('PDF 尚未确认生成，请稍后重试。');}
  finally{clearTimeout(timer);if(request.current===controller)setBusy(false);}
 }
 return <div className="pdf-controls">
  <div className="pdf-actions"><a className="secondary-link" href={`/help-centre?article=${encodeURIComponent(documentId)}`}>← 返回文章</a><button className="secondary-link" type="button" disabled={busy} onClick={()=>void download()}>{busy?'正在生成 PDF…':'下载 PDF'}</button><PrintButton disabled={!ready||imageError} documentId={documentId} revision={revision} coverId={coverId}/></div>
  <p>当前为正式版本 {revision}。下载内容以生成时的权限检查为准。</p>
  {(!ready||imageError)&&<p role="alert">{imageError?'封面未能加载，打印暂不可用。请重新载入页面；下载时服务器也会检查图片。':'正在准备图片，请稍候…'}</p>}
  <p role="status">{message}</p>
 </div>;
}
