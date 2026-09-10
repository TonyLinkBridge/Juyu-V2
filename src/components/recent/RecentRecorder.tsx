'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {recordRecentView} from '../../recent/client';
type Props={documentId:string;revision:number};
export function RecentRecorder(props:Props){return <Recorder key={`${props.documentId}:${props.revision}`} {...props}/>;}
function Recorder({documentId,revision}:Props){
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 const state=useRef({attempted:false,pending:false,generation:0,controller:null as AbortController|null});
 const record=useCallback(()=>{
  const current=state.current;if(current.pending||document.visibilityState!=='visible')return;
  current.attempted=true;current.pending=true;const token=++current.generation;
  const controller=new AbortController();current.controller=controller;
  return recordRecentView(documentId,revision,controller.signal).then(()=>{if(token===current.generation)setError('');},e=>{
   if(token!==current.generation)return;
   setError(e instanceof Error&&['FORBIDDEN','NOT_FOUND','VERSION_CHANGED'].includes(e.message)?'文章或权限已变化，本次浏览未记录。请刷新文章。':'本次浏览尚未确认记录，不影响阅读。可以重试保存到最近浏览。');
  }).finally(()=>{if(token===current.generation){current.pending=false;setBusy(false);}});
 },[documentId,revision]);
 useEffect(()=>{
  const current=state.current;let frame=0;
  const visible=()=>{if(!current.attempted&&document.visibilityState==='visible'){cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(!current.attempted)void record();});}};
  const restored=(event:PageTransitionEvent)=>{if(event.persisted&&!current.pending){current.attempted=false;visible();}};
  visible();document.addEventListener('visibilitychange',visible);window.addEventListener('pageshow',restored);
  return()=>{cancelAnimationFrame(frame);current.generation++;current.controller?.abort();current.pending=false;current.attempted=false;document.removeEventListener('visibilitychange',visible);window.removeEventListener('pageshow',restored);};
 },[record]);
 function retry(){if(state.current.pending||document.visibilityState!=='visible')return;setBusy(true);void record();}
 if(!error)return null;
 return <aside className="recent-recording" aria-label="最近浏览记录"><p role="status">{error}</p><div className="favorite-recovery"><button className="secondary-link" type="button" disabled={busy} onClick={retry}>{busy?'正在记录…':'重试记录浏览'}</button><a href={`/help-centre?article=${encodeURIComponent(documentId)}`}>刷新文章</a></div></aside>;
}
