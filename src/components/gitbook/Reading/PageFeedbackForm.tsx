'use client';
// Adapted from GitBook PageFeedbackForm: rating controls, optional comment,
// input focus and confirmed success. JUYU stores one editable response/version.
import {useCallback,useEffect,useId,useRef,useState} from 'react';
import {ThumbsUp,ThumbsDown} from '@phosphor-icons/react';
import type {SavedFeedback} from '../../../feedback/model';
export function PageFeedbackForm({documentId,revision,initial,publicationNumber}:{publicationNumber?:number|null;documentId:string;revision:number;initial?:SavedFeedback|null}){
 const id=useId();
 const commentRef=useRef<HTMLTextAreaElement>(null);
 const request=useRef<AbortController|null>(null);
 const [saved,setSaved]=useState<SavedFeedback|null>(initial??null);
 const [helpful,setHelpful]=useState<boolean|null>(initial?.helpful??null);
 const [comment,setComment]=useState(initial?.comment??'');
 const [loaded,setLoaded]=useState(initial!==undefined);
 const [busy,setBusy]=useState(initial===undefined);
 const [error,setError]=useState('');
 const [blocked,setBlocked]=useState(false);
 const [success,setSuccess]=useState(false);
 const endpoint=`/api/articles/${encodeURIComponent(documentId)}/feedback?revision=${revision}`;
 const completeLoad=useCallback((feedback:SavedFeedback|null)=>{
  setSaved(feedback);setHelpful(feedback?.helpful??null);setComment(feedback?.comment??'');setLoaded(true);setBlocked(false);setBusy(false);
 },[setSaved,setHelpful,setComment,setLoaded,setBlocked,setBusy]);
 const failLoad=useCallback(()=>{setError('反馈暂时无法读取，你仍可继续阅读文章。');setBusy(false);},[setError,setBusy]);
 const load=useCallback(()=>{
  request.current?.abort();const controller=new AbortController();request.current=controller;
  const timer=setTimeout(()=>controller.abort(),12000);
  void fetch(endpoint,{cache:'no-store',credentials:'same-origin',signal:controller.signal})
   .then(async response=>{if(!response.ok)throw new Error('load');return response.json();})
   .then(data=>{if(request.current===controller)completeLoad(data.feedback);})
   .catch(()=>{if(request.current===controller)failLoad();})
   .finally(()=>clearTimeout(timer));
 },[endpoint,completeLoad,failLoad]);
 const hasInitial=initial!==undefined;
 useEffect(()=>{if(!hasInitial)load();return()=>{const current=request.current;request.current=null;current?.abort();};},[load,hasInitial]);
 async function submit(event:React.FormEvent){
  event.preventDefault();if(busy||blocked||!loaded||helpful===null)return;
  setBusy(true);setError('');setSuccess(false);
  const controller=new AbortController();request.current=controller;const timer=setTimeout(()=>controller.abort(),12000);
  try{
   const response=await fetch(endpoint,{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,helpful,comment,expectedVersion:saved?.version??0}),signal:controller.signal});
   const result=await response.json();if(request.current!==controller)return;
   if(!response.ok){
    if(result.error==='CONFLICT'){setBlocked(true);setError('这份反馈已在另一页面更新。请重新读取后再修改；重新读取会替换当前输入。');return;}
    if(result.error==='VERSION_CHANGED'||response.status===404||response.status===403){setBlocked(true);setError('文章版本或访问权限已变化，请刷新文章后再反馈。');return;}
    setError('反馈未确认保存，输入已保留。请重试。');return;
   }
   setSaved(result.feedback);setHelpful(result.feedback.helpful);setComment(result.feedback.comment??'');setSuccess(true);
  }catch{if(request.current===controller)setError('反馈未确认保存，输入已保留。请重试。');}
  finally{clearTimeout(timer);if(request.current===controller)setBusy(false);}
 }
 const edited=()=>{setSuccess(false);setError('');};
 return <section aria-label="文章反馈" className="reader-feedback">
  <form onSubmit={submit}>
   <div className="feedback-rating"><p id={`${id}-question`}>这篇文章有帮助吗？</p><div role="group" aria-labelledby={`${id}-question`}>
    {([true,false] as const).map(value=><button key={String(value)} type="button" aria-pressed={helpful===value} disabled={!loaded||busy||blocked} onClick={()=>{setHelpful(value);edited();requestAnimationFrame(()=>commentRef.current?.focus());}}>{value?<ThumbsUp size={17} aria-hidden="true"/>:<ThumbsDown size={17} aria-hidden="true"/>}<span className="feedback-label">{value?'有帮助':'没有帮助'}</span></button>)}
   </div></div>
   <p className="feedback-privacy">反馈对应{publicationNumber?`正式版本 ${publicationNumber}`:'当前已发布内容'}，管理员可查看你的选择和说明。</p>
   {helpful!==null&&<div className="feedback-comment"><label htmlFor={`${id}-comment`}>补充说明（选填）</label><textarea ref={commentRef} id={`${id}-comment`} rows={3} maxLength={1000} value={comment} disabled={busy||blocked} onChange={e=>{setComment(e.target.value);edited();}}/>
    <div className="feedback-submit"><span>{comment.length}/1000</span><button className="secondary-link" type="submit" disabled={busy||blocked||!loaded}>{busy?'正在保存…':saved?'更新反馈':'提交反馈'}</button></div>
   </div>}
   <p role="status" className="feedback-status">{success?'反馈已保存，谢谢。你可以继续修改。':!loaded&&busy?'正在读取反馈…':saved&&!error?'已载入你之前的反馈，可修改后保存。':''}</p>
   {error&&<p role="alert" className="feedback-error">{error}</p>}
   {((!loaded&&!busy)||blocked)&&<button type="button" className="secondary-link" disabled={busy} onClick={()=>{setBusy(true);setSuccess(false);setError('');setLoaded(false);void load();}}>重新读取反馈</button>}
  </form>
 </section>;
}
