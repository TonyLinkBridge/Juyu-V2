'use client';
import {contentPath} from '../../reader/content-path';
import type {ContentKind} from '../../domain/model';
import {BookmarkSimple} from '@phosphor-icons/react';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {FavoriteState} from '../../favorites/model';
import {readFavoriteState,setFavoriteState,FavoriteRejected} from '../../favorites/client';

type Props={kind?:ContentKind;documentId:string;revision:number;initial?:FavoriteState;onChange?:(state:FavoriteState)=>void;label?:string};
type CachedFavorite={state:FavoriteState;updatedAt:number};
const FAVORITE_CACHE_TTL=30_000;
const favoriteCache=new Map<string,CachedFavorite>();
export function FavoriteButton(props:Props){return <FavoriteControl key={`${props.documentId}:${props.revision}`} {...props}/>;}

function FavoriteControl({kind='article',documentId,revision,initial,onChange,label='文章收藏'}:Props){
 const cacheKey=`${documentId}:${revision}`;
 const [saved,setSaved]=useState<boolean|null>(initial?.saved??null),[busy,setBusy]=useState<'read'|'write'|''>(initial?'':'read'),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [pending,setPending]=useState<{saved:boolean}|null>(null);
 const operation=useRef(false),generation=useRef({value:0}),pendingRequest=useRef<{saved:boolean}|null>(null);
 const hasInitial=initial!==undefined;
 const load=useCallback((force=false)=>{
  if(operation.current||pendingRequest.current)return;
  const cached=favoriteCache.get(cacheKey);
  if(!force&&cached&&Date.now()-cached.updatedAt<FAVORITE_CACHE_TTL){
   setSaved(cached.state.saved);setBusy('');
   return;
  }

  operation.current=true;const sequence=generation.current;const token=++sequence.value;
  return readFavoriteState(documentId,revision).then(result=>{
   if(token===sequence.value){favoriteCache.set(cacheKey,{state:result,updatedAt:Date.now()});setSaved(result.saved);}
  },e=>{
   if(token===sequence.value)setError(e instanceof Error&&['FORBIDDEN','NOT_FOUND','VERSION_CHANGED'].includes(e.message)?'文章已更新或当前无法访问，请刷新文章后再操作。':'收藏状态暂时无法读取，请重试。');
  }).finally(()=>{
   if(token===sequence.value){operation.current=false;setBusy('');}
  });
 },[cacheKey,documentId,revision]);

 const reload=useCallback(()=>{
  if(operation.current||pendingRequest.current)return;
  setBusy('read');setError('');setNotice('');void load(true);
 },[load]);

 useEffect(()=>{
  const sequence=generation.current;

  if(initial)favoriteCache.set(cacheKey,{state:initial,updatedAt:Date.now()});
  if(!hasInitial)void load();

  const focus=()=>{if(!onChange)void load();};
  window.addEventListener('focus',focus);

  return()=>{
   sequence.value++;operation.current=false;
   window.removeEventListener('focus',focus);
  };
 },[cacheKey,hasInitial,initial,load,onChange]);

 async function change(){
  if(operation.current||(!pendingRequest.current&&saved===null))return;
  const wasUncertain=pendingRequest.current!==null;const desired=pendingRequest.current??{saved:!saved};
  pendingRequest.current=desired;setPending(desired);operation.current=true;
  const sequence=generation.current;const token=++sequence.value;setBusy('write');setError('');setNotice('');

  try{
   const result=await setFavoriteState(documentId,revision,desired.saved);
   if(token!==sequence.value)return;
   pendingRequest.current=null;setPending(null);
   favoriteCache.set(cacheKey,{state:result,updatedAt:Date.now()});
   setSaved(result.saved);setNotice(result.saved?'已加入我的收藏。':'已取消收藏。');onChange?.(result);
  }catch(e){
   if(token!==sequence.value)return;
   const unknown=wasUncertain||!(e instanceof FavoriteRejected);
   if(!unknown){pendingRequest.current=null;setPending(null);favoriteCache.delete(cacheKey);setSaved(null);}
   setError(unknown?'收藏结果尚未确认，原操作已保留，请重试。':'文章或权限已变化，操作未执行。请重新读取或刷新文章。');
  }finally{
   if(token===sequence.value){operation.current=false;setBusy('');}
  }
 }

 return <section className="favorite-control" aria-label={label}><button className="secondary-link" type="button" aria-pressed={saved??false} aria-busy={Boolean(busy)} disabled={Boolean(busy)||(!pending&&saved===null)} onClick={()=>void change()}><BookmarkSimple size={20} aria-hidden="true"/>{busy==='write'?'正在保存…':busy==='read'?'收藏文章':pending?(pending.saved?'重试收藏':'重试取消收藏'):saved?'取消收藏':'收藏文章'}</button>{notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}{!busy&&!pending&&error&&<div className="favorite-recovery"><button className="secondary-link" type="button" onClick={reload}>重新读取收藏</button><a href={contentPath(kind,documentId)}>刷新文章</a></div>}</section>;
}