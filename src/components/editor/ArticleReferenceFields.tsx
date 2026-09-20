'use client';
import {useEffect,useState} from 'react';
import type {MediaBlock} from '../../media/model';
import type {WorkspaceData} from '../../workspace/model';

type Reference=Extract<MediaBlock,{type:'articleReference'}>;
export function ArticleReferenceFields({block,onChange}:{block:Reference;onChange:(block:Reference)=>void}){
 const [query,setQuery]=useState(''),[items,setItems]=useState<WorkspaceData['items']>([]),[title,setTitle]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{if(!block.targetId)return;const controller=new AbortController();void fetch(`/api/admin/editor/${encodeURIComponent(block.targetId)}`,{signal:controller.signal,cache:'no-store'}).then(async response=>{if(!response.ok)throw new Error('LOOKUP_FAILED');return response.json();}).then(data=>setTitle(typeof data?.title==='string'?data.title:'' )).catch(()=>{if(!controller.signal.aborted)setTitle('');});return()=>controller.abort();},[block.targetId]);
 useEffect(()=>{if(query.trim().length<2)return;const controller=new AbortController();const timer=setTimeout(()=>{const params=new URLSearchParams({q:query.trim(),kind:'article',view:'list'});void fetch(`/api/admin/workspace?${params}`,{signal:controller.signal,cache:'no-store'}).then(async response=>{if(!response.ok)throw new Error('SEARCH_FAILED');return response.json() as Promise<WorkspaceData>;}).then(data=>{setItems(data.items.filter(item=>item.publishedRevision!==null));setMessage(data.items.some(item=>item.publishedRevision!==null)?'选择要引用的文章。':'没有找到已发布的文章。');}).catch(()=>{if(!controller.signal.aborted)setMessage('暂时无法搜索文章，请稍后重试。');});},300);return()=>{clearTimeout(timer);controller.abort();};},[query]);
 const visibleItems=query.trim().length<2?[]:items;
 return <div className="article-reference-fields"><p>引用其他已发布文章。员工只能看到自己有权限阅读的引用卡片。</p>{block.targetId&&<p>当前引用：<strong>{title||block.targetId}</strong></p>}<label>搜索要引用的文章<input aria-label="搜索引用文章" value={query} maxLength={120} placeholder="输入文章标题" onChange={event=>setQuery(event.target.value)}/></label><p role="status">{query.trim().length<2?'输入至少两个字搜索已发布文章。':message}</p>{visibleItems.length>0&&<div role="listbox" aria-label="引用文章结果" className="article-reference-results">{visibleItems.map(item=><button key={item.id} type="button" role="option" aria-selected={block.targetId===item.id} onClick={()=>{onChange({...block,targetId:item.id});setTitle(item.title);setQuery('');setItems([]);}}>{item.title}</button>)}</div>}</div>;
}
