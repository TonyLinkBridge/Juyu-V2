'use client';
import {useAuth} from '@clerk/nextjs';
import {contentPath} from '../../reader/content-path';
import {useCallback,useEffect,useRef,useState} from 'react';
import {readFavoritesPage,FavoriteRejected} from '../../favorites/client';
import type {FavoriteState} from '../../favorites/model';
import type {FavoritesPage} from '../../favorites/model';
import {kinds} from '../../workspace/model';
import {SearchResultItem} from '../gitbook/Search/SearchResultItem';
import {FavoriteButton} from './FavoriteButton';
type Props={viewerId?:string;data?:FavoritesPage;state:'ready'|'denied'|'unavailable'};
export function FavoritesView(props:Props){
 const {isLoaded,userId,sessionId}=useAuth();
 if(!isLoaded)return <p role="status">正在确认收藏账号…</p>;
 if(!sessionId||!userId||props.viewerId!==userId)return <p role="alert">登录状态已变化，请刷新页面重新读取收藏。</p>;
 return <FavoritesCollection key={JSON.stringify(props)} {...props}/>;}
function FavoritesCollection({data:initial,state,viewerId}:Props){
 const [data,setData]=useState(initial),[message,setMessage]=useState(''),[refreshFailed,setRefreshFailed]=useState(false),[refreshing,setRefreshing]=useState(false);
 const removed=useRef(new Set<string>()),generation=useRef(0);
 useEffect(()=>()=>{generation.current++;},[]);
 const update=useCallback((result:FavoriteState)=>{
  if(result.saved||removed.current.has(result.documentId))return;
  removed.current.add(result.documentId);const token=++generation.current;
  setData(current=>current?{...current,items:current.items.filter(item=>item.id!==result.documentId),total:Math.max(0,current.total-1)}:current);
  setMessage('已取消收藏。');setRefreshFailed(false);setRefreshing(true);
  void readFavoritesPage(initial?.page??1).then(latest=>{if(token===generation.current)setData({...latest,items:latest.items.filter(item=>!removed.current.has(item.id))});}).catch(error=>{if(token===generation.current){if(error instanceof FavoriteRejected)setData(undefined);setRefreshFailed(true);setMessage('已取消收藏，但最新列表暂时无法读取。其他收藏保持不变，请刷新列表后继续翻页。');}}).finally(()=>{if(token===generation.current)setRefreshing(false);});
 },[initial?.page]);
 return <section className="favorites-view" aria-label="我的收藏"><a className="search-back" href="/help-centre">← 返回员工资料库</a><header><p className="reader-eyebrow">PERSONAL</p><h1>我的收藏</h1><p className="reader-description">保存常用资料，方便下次查阅。这里显示你目前有权阅读的最新正式版本。</p></header>
 {state!=='ready'||!data?<div role="alert" className="search-state"><h2>{state==='denied'?'收藏访问已暂停':'收藏暂时无法读取'}</h2><p>请重新读取；如果持续失败，请联系管理员。</p><a className="secondary-link" href="/help-centre/favorites">重新读取收藏列表</a></div>:<><a className="secondary-link" href={`/help-centre/favorites?page=${data.page}`}>刷新收藏</a>{message&&<p role={refreshFailed?"alert":"status"}>{message}</p>}<p className="search-summary" role="status">共 {data.total} 篇可阅读的收藏 · 第 {data.page} / {data.pages} 页</p>
 {data.items.length?<ul className="gitbook-search-results favorites-results" aria-label="已收藏的正式资料">{data.items.map(item=><li key={item.id}><SearchResultItem href={contentPath(item.kind,item.id)} label={`阅读收藏：${item.title}`} leadingIcon={<span aria-hidden="true">☆</span>}><p className="search-result-breadcrumbs">{kinds[item.kind]} · 已发布</p><h2>{item.title}</h2>{item.tags.length>0&&<p className="search-result-breadcrumbs">{item.tags.join(' · ')}</p>}</SearchResultItem><div className="favorite-item-actions"><FavoriteButton viewerId={viewerId} documentId={item.id} revision={item.revision} initial={{documentId:item.id,revision:item.revision,saved:true}} onChange={update} kind={item.kind} label={`收藏操作：${item.title}`}/></div></li>)}</ul>:<div className="search-state"><h2>{data.total===0?'暂无可阅读的收藏':'本页收藏已取消'}</h2><p>打开一篇正式文章，点击“收藏文章”，即可在这里找到。有些已收藏资料可能已下线或不再有访问权限。</p><a className="secondary-link" href="/help-centre">前往资料库</a></div>}
 {data.pages>1&&!refreshFailed&&!refreshing&&<nav className="search-pagination" aria-label="收藏翻页">{data.page>1&&<a className="secondary-link" href={`/help-centre/favorites?page=${data.page-1}`}>上一页</a>}<span>{data.page} / {data.pages}</span>{data.page<data.pages&&<a className="secondary-link" href={`/help-centre/favorites?page=${data.page+1}`}>下一页</a>}</nav>}
 </>}
 </section>;
}
