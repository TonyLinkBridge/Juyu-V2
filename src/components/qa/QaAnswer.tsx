'use client';
import {useEffect,useRef,useState} from 'react';
import type {Publication} from '../../reader/body';
import {answerDocument} from '../../qa/presentation';
import {DocumentView} from '../gitbook/Reading/DocumentView';
import {MediaBlocks} from '../gitbook/Media/MediaBlocks';
export function QaAnswer({id,title,revision,canEdit=false}:{id:string;title:string;revision?:number;canEdit?:boolean}){
 const [open,setOpen]=useState(false),[answer,setAnswer]=useState<(Publication&{sourceRevision?:number})|null>(null),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
 const cached=useRef<{value:Publication;sourceRevision:number|undefined;expires:number}|null>(null);
 useEffect(()=>{const locate=()=>{if(window.location.hash==='#qa-'+encodeURIComponent(id)){if(!cached.current||cached.current.expires<=Date.now())setAnswer(null);setOpen(true);}};locate();window.addEventListener('hashchange',locate);return()=>window.removeEventListener('hashchange',locate);},[id]);
 const active=useRef(true),generation=useRef(0);
 // Component memory only: never persist private answers across pages or accounts.
 useEffect(()=>{
  const invalidate=()=>{generation.current++;cached.current=null;setAnswer(null);setFailed(false);setRetry(v=>v+1);};
  const pause=()=>{active.current=false;invalidate();};
  const resume=()=>{active.current=!window.document.hidden;invalidate();};
  const visibility=()=>window.document.hidden?pause():resume();
  window.addEventListener('blur',pause);window.addEventListener('focus',resume);window.addEventListener('pageshow',resume);window.document.addEventListener('visibilitychange',visibility);
  return()=>{window.removeEventListener('blur',pause);window.removeEventListener('focus',resume);window.removeEventListener('pageshow',resume);window.document.removeEventListener('visibilitychange',visibility);};
 },[]);
 useEffect(()=>{
  if(!open||!active.current||window.document.hidden)return;
  const existing=cached.current;
  if(existing&&existing.value.id===id&&existing.sourceRevision===revision&&existing.expires>Date.now()){
   setAnswer({...existing.value,sourceRevision:revision});setFailed(false);
   const timer=setTimeout(()=>{cached.current=null;setAnswer(null);setRetry(v=>v+1);},existing.expires-Date.now());
   return()=>clearTimeout(timer);
  }
  cached.current=null;setAnswer(null);setFailed(false);
  const abort=new AbortController(),requestGeneration=generation.current;let timer:ReturnType<typeof setTimeout>|undefined;
  fetch('/api/qa/'+encodeURIComponent(id),{cache:'no-store',signal:abort.signal}).then(async r=>{
   if(!r.ok)throw new Error();const value=await r.json();
   if(value.id!==id||typeof value.body!=='string'||!Number.isSafeInteger(value.revision)||value.revision<1||(revision!==undefined&&value.revision<revision))throw new Error();
   if(abort.signal.aborted||!active.current||requestGeneration!==generation.current)return;
   cached.current={value,sourceRevision:revision,expires:Date.now()+30_000};setAnswer({...value,sourceRevision:revision});
   timer=setTimeout(()=>{cached.current=null;setAnswer(null);setRetry(v=>v+1);},30_000);
  }).catch(()=>{if(!abort.signal.aborted&&active.current&&requestGeneration===generation.current){cached.current=null;setAnswer(null);setFailed(true);}});
  return()=>{abort.abort();clearTimeout(timer);};
 },[id,revision,open,retry]);
 const document=answer&&answer.id===id&&answer.sourceRevision===revision?answerDocument(answer.body,id):null;
 return <article className="qa-question" id={'qa-'+encodeURIComponent(id)}><h2><button type="button" aria-expanded={open} aria-controls={'answer-'+id} onClick={()=>{if(!cached.current||cached.current.expires<=Date.now())setAnswer(null);setFailed(false);setOpen(v=>!v);}}><span>{title}</span><span aria-hidden="true">{open?'−':'+'}</span></button></h2>{open&&<div className="qa-answer" id={'answer-'+id}>{failed?<div role="alert"><p>答案暂时无法读取，或你已没有阅读权限。</p><button onClick={()=>{cached.current=null;setFailed(false);setAnswer(null);setRetry(v=>v+1);}}>重新读取</button></div>:!answer||!document?<p role="status">正在读取标准答案…</p>:<><DocumentView document={document} documentId={id} revision={answer.revision}/>{!document.editorBlocks&&<MediaBlocks blocks={answer.blocks} documentId={id} revision={answer.revision}/>}<p className="qa-answer-meta">已审核发布 · 正式版 {answer.revision}</p></>}<div className="qa-answer-actions"><a href={'/help-centre/qa?question='+encodeURIComponent(id)+'#qa-'+encodeURIComponent(id)}>此问题的独立链接</a>{canEdit&&<a href={'/admin/editor?article='+encodeURIComponent(id)}>编辑问答</a>}</div></div>}</article>;
}
