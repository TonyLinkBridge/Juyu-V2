'use client';
import {useEffect,useState} from 'react';
import type {Publication} from '../../reader/body';
import {answerDocument} from '../../qa/presentation';
import {DocumentView} from '../gitbook/Reading/DocumentView';
import {MediaBlocks} from '../gitbook/Media/MediaBlocks';
export function QaAnswer({id,title,canEdit=false}:{id:string;title:string;canEdit?:boolean}){
 const [open,setOpen]=useState(false),[answer,setAnswer]=useState<Publication|null>(null),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{const locate=()=>{if(window.location.hash==='#qa-'+encodeURIComponent(id))setOpen(true);};locate();window.addEventListener('hashchange',locate);return()=>window.removeEventListener('hashchange',locate);},[id]);
 useEffect(()=>{if(!open)return;const abort=new AbortController();fetch('/api/qa/'+encodeURIComponent(id),{cache:'no-store',signal:abort.signal}).then(async r=>{if(!r.ok)throw new Error();const value=await r.json();if(value.id!==id||typeof value.body!=='string')throw new Error();if(!abort.signal.aborted)setAnswer(value);}).catch(()=>{if(!abort.signal.aborted)setFailed(true);});return()=>abort.abort();},[id,open,retry]);
 const document=answer?answerDocument(answer.body,id):null;
 return <article className="qa-question" id={'qa-'+encodeURIComponent(id)}><h2><button type="button" aria-expanded={open} aria-controls={'answer-'+id} onClick={()=>{setAnswer(null);setFailed(false);setOpen(v=>!v);}}><span>{title}</span><span aria-hidden="true">{open?'−':'+'}</span></button></h2>{open&&<div className="qa-answer" id={'answer-'+id}>{failed?<div role="alert"><p>答案暂时无法读取，或你已没有阅读权限。</p><button onClick={()=>{setFailed(false);setAnswer(null);setRetry(v=>v+1);}}>重新读取</button></div>:!answer||!document?<p role="status">正在读取标准答案…</p>:<><DocumentView document={document} documentId={id} revision={answer.revision}/>{!document.editorBlocks&&<MediaBlocks blocks={answer.blocks} documentId={id} revision={answer.revision}/>}<p className="qa-answer-meta">已审核发布 · 正式版 {answer.revision}</p></>}<div className="qa-answer-actions"><a href={'/help-centre/qa?question='+encodeURIComponent(id)+'#qa-'+encodeURIComponent(id)}>此问题的独立链接</a>{canEdit&&<a href={'/admin/editor?article='+encodeURIComponent(id)}>编辑问答</a>}</div></div>}</article>;
}
