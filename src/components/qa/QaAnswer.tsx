'use client';
import {useEffect,useRef,useState} from 'react';
import type {Publication} from '../../reader/body';
import {answerDocument} from '../../qa/presentation';
import {createAnswerCache} from '../../qa/answer-cache';
import {DocumentView} from '../gitbook/Reading/DocumentView';
import {MediaBlocks} from '../gitbook/Media/MediaBlocks';
const answerCache=createAnswerCache<Publication>();
export function QaAnswer({id,title,revision,canEdit=false,initial,cacheScope=''}:{id:string;title:string;revision?:number;canEdit?:boolean;initial?:Publication;cacheScope?:string}){
 const localCache=useRef(createAnswerCache<Publication>());
 const initialTime=useRef(0);
 const [open,setOpen]=useState(Boolean(initial)),[answer,setAnswer]=useState<Publication|null>(initial??null),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{const locate=()=>{if(window.location.hash==='#qa-'+encodeURIComponent(id))setOpen(true);};locate();window.addEventListener('hashchange',locate);return()=>window.removeEventListener('hashchange',locate);},[id]);
 useEffect(()=>{
  if(!open)return;
  let disposed=false,pending=false;
  let controller:AbortController|undefined;
  const cache=cacheScope?answerCache:localCache.current;
  const cached=cache.get(cacheScope,id,revision),retained=cache.peek(cacheScope,id,revision);
  if(initialTime.current===0)initialTime.current=Date.now();
  const freshInitial=initial&&Date.now()-initialTime.current<30_000?initial:undefined;
  if(freshInitial&&!cached)cache.put(cacheScope,id,revision,freshInitial);
  if(retry===0&&(freshInitial||cached||retained))setAnswer(freshInitial??cached??retained!);
  const read=async()=>{
   if(disposed||pending||window.document.hidden)return;
   pending=true;controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),12_000);
   try{
    const response=await fetch('/api/qa/'+encodeURIComponent(id),{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw new Error(response.status===403||response.status===404?'denied':'unavailable');const value=await response.json();
    if(value.id!==id||typeof value.body!=='string'||!Number.isSafeInteger(value.revision)||value.revision<1||(revision!==undefined&&value.revision<revision))throw new Error('invalid');
    if(disposed)return;
    cache.put(cacheScope,id,revision,value);
    setAnswer(value);setFailed(false);
   }catch(error){if(!disposed){const reason=error instanceof Error?error.message:'unavailable';if(reason==='denied'||reason==='invalid'){initialTime.current=Number.NEGATIVE_INFINITY;cache.clear();setAnswer(null);}setFailed(true);}}
   finally{clearTimeout(timeout);pending=false;}
  };
  if(retry>0||(!freshInitial&&!cached))void read();
  // Returning to the page may revalidate an expired answer, while retained
  // content remains visible unless access is explicitly denied.
  let lastResume=0;
  const resume=()=>{if(Date.now()-lastResume<1_000)return;lastResume=Date.now();if(!cache.get(cacheScope,id,revision))void read();};
  window.addEventListener('focus',resume);window.addEventListener('pageshow',resume);window.document.addEventListener('visibilitychange',resume);
  const clear=()=>{disposed=true;controller?.abort();initialTime.current=Number.NEGATIVE_INFINITY;cache.clear();setAnswer(null);setFailed(true);};
  window.addEventListener('juyu-clear-recovery',clear);
  return()=>{disposed=true;controller?.abort();window.removeEventListener('focus',resume);window.removeEventListener('pageshow',resume);window.document.removeEventListener('visibilitychange',resume);window.removeEventListener('juyu-clear-recovery',clear);};
 },[id,revision,open,retry,initial,cacheScope]);
 const document=answer&&answer.id===id?answerDocument(answer.body,id):null;
 return <article className="qa-question" id={'qa-'+encodeURIComponent(id)}><h2><button type="button" aria-expanded={open} aria-controls={'answer-'+id} onClick={()=>{setFailed(false);setOpen(v=>!v);}}><span>{title}</span><span aria-hidden="true">{open?'−':'+'}</span></button></h2>{open&&<div className="qa-answer" id={'answer-'+id}>{failed&&!answer?<div role="alert"><p>答案暂时无法读取，或你已没有阅读权限。</p><button onClick={()=>{answerCache.clear();localCache.current.clear();setFailed(false);setAnswer(null);setRetry(v=>v+1);}}>重新读取</button></div>:!answer||!document?<p role="status">正在读取标准答案…</p>:<><DocumentView document={document} documentId={id} revision={answer.revision}/>{!document.editorBlocks&&<MediaBlocks blocks={answer.blocks} documentId={id} revision={answer.revision}/>}<p className="qa-answer-meta">已审核发布{answer.publicationNumber?` · 正式版本 ${answer.publicationNumber}`:''}</p>{failed&&<p role="status">答案已保留，最新状态暂时无法确认。</p>}</>}<div className="qa-answer-actions"><a href={'/help-centre/qa?question='+encodeURIComponent(id)+'#qa-'+encodeURIComponent(id)}>此问题的独立链接</a>{canEdit&&<a href={'/admin/editor?article='+encodeURIComponent(id)}>编辑问答</a>}</div></div>}</article>;
}
