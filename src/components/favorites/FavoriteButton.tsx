'use client';
import {useAuth} from '@clerk/nextjs';
import {createAnswerCache} from '../../qa/answer-cache';
import {contentPath} from '../../reader/content-path';
import type {ContentKind} from '../../domain/model';
import {BookmarkSimple} from '@phosphor-icons/react';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {FavoriteState} from '../../favorites/model';
import {readFavoriteState,setFavoriteState,FavoriteRejected} from '../../favorites/client';

type Props={viewerId?:string;kind?:ContentKind;documentId:string;revision:number;initial?:FavoriteState;onChange?:(state:FavoriteState)=>void;label?:string};
const favoriteCache=createAnswerCache<FavoriteState>(30_000,50);
// This listener lives as long as the cache, including after all buttons unmount.
if(typeof window!=='undefined')window.addEventListener('juyu-clear-recovery',()=>favoriteCache.clear());
export function FavoriteButton(props:Props){
 const {isLoaded,userId,sessionId}=useAuth();
 useEffect(()=>{if(!sessionId)favoriteCache.clear();},[sessionId]);
 if(!isLoaded)return <p role="status">正在确认收藏账号…</p>;
 if(!userId||!sessionId)return <p role="status">请登录后查看收藏。</p>;
 const scope=JSON.stringify([userId,sessionId]);
 return <FavoriteControl key={`${scope}:${props.documentId}:${props.revision}`} {...props} initial={props.viewerId===userId?props.initial:undefined} scope={scope}/>;
}

function FavoriteControl({scope,kind='article',documentId,revision,initial,onChange,label='文章收藏'}:Props&{scope:string}){
 const [saved,setSaved]=useState<boolean|null>(initial?.saved??null),[busy,setBusy]=useState<'read'|'write'|''>(initial?'':'read'),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [pending,setPending]=useState<{saved:boolean}|null>(null);
 const revoked=useRef(false);
 const operation=useRef(false),generation=useRef({value:0}),pendingRequest=useRef<{saved:boolean}|null>(null);
 const hasInitial=initial!==undefined;
 const load=useCallback((force=false)=>{
  if(revoked.current||operation.current||pendingRequest.current)return;
  const cached=force?undefined:favoriteCache.get(scope,documentId,revision);

  operation.current=true;const sequence=generation.current;const token=++sequence.value;
  return (cached?Promise.resolve(cached):readFavoriteState(documentId,revision)).then(result=>{
   if(token===sequence.value){favoriteCache.put(scope,documentId,revision,result);setSaved(result.saved);}
  },e=>{
   if(token===sequence.value){favoriteCache.clear();setSaved(null);setError(e instanceof Error&&['FORBIDDEN','NOT_FOUND','VERSION_CHANGED'].includes(e.message)?'文章已更新或当前无法访问，请刷新文章后再操作。':'收藏状态暂时无法读取，请重试。');}
  }).finally(()=>{
   if(token===sequence.value){operation.current=false;setBusy('');}
  });
 },[scope,documentId,revision]);

 const reload=useCallback(()=>{
  if(revoked.current||operation.current||pendingRequest.current)return;
  setBusy('read');setError('');setNotice('');void load(true);
 },[load]);

 useEffect(()=>{
  const sequence=generation.current;

  if(initial)favoriteCache.put(scope,documentId,revision,initial);
  if(!hasInitial)void load();

  const focus=()=>{if(!onChange)void load(true);};
  const clear=()=>{revoked.current=true;sequence.value++;operation.current=false;favoriteCache.clear();pendingRequest.current=null;setPending(null);setSaved(null);setBusy('');setError('登录状态已变化，请刷新页面。');};
  window.addEventListener('juyu-clear-recovery',clear);
  window.addEventListener('focus',focus);

  return()=>{
   sequence.value++;operation.current=false;
   window.removeEventListener('focus',focus);window.removeEventListener('juyu-clear-recovery',clear);
  };
 },[scope,documentId,revision,hasInitial,initial,load,onChange]);

 async function change(){
  if(revoked.current||operation.current||(!pendingRequest.current&&saved===null))return;
  const wasUncertain=pendingRequest.current!==null;const desired=pendingRequest.current??{saved:!saved};
  pendingRequest.current=desired;setPending(desired);operation.current=true;
  const sequence=generation.current;const token=++sequence.value;setBusy('write');setError('');setNotice('');

  try{
   const result=await setFavoriteState(documentId,revision,desired.saved);
   if(token!==sequence.value)return;
   pendingRequest.current=null;setPending(null);
   favoriteCache.put(scope,documentId,revision,result);
   setSaved(result.saved);setNotice(result.saved?'已加入我的收藏。':'已取消收藏。');onChange?.(result);
  }catch(e){
   if(token!==sequence.value)return;
   const unknown=wasUncertain||!(e instanceof FavoriteRejected);
   if(!unknown){pendingRequest.current=null;setPending(null);favoriteCache.clear();setSaved(null);}
   setError(unknown?'收藏结果尚未确认，原操作已保留，请重试。':'文章或权限已变化，操作未执行。请重新读取或刷新文章。');
  }finally{
   if(token===sequence.value){operation.current=false;setBusy('');}
  }
 }

 return <section className="favorite-control" aria-label={label}><button className="secondary-link" type="button" aria-pressed={saved??false} aria-busy={Boolean(busy)} disabled={Boolean(busy)||(!pending&&saved===null)} onClick={()=>void change()}><BookmarkSimple size={20} aria-hidden="true"/>{busy==='write'?'正在保存…':busy==='read'?'收藏文章':pending?(pending.saved?'重试收藏':'重试取消收藏'):saved?'取消收藏':'收藏文章'}</button>{notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}{!busy&&!pending&&error&&<div className="favorite-recovery"><button className="secondary-link" type="button" onClick={reload}>重新读取收藏</button><a href={contentPath(kind,documentId)}>刷新文章</a></div>}</section>;
}