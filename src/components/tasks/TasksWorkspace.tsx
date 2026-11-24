'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {notifyWorkspaceChange,workspaceChangedSinceLoad,workspaceChangeKey} from '../../workspace/freshness';
import {readWithdrawWorkspace} from '../../review/bulk-withdraw-client';
import type {BulkWithdrawResult} from '../../review/bulk-withdraw';
import type {FeatureFlags} from '../../features/model';
import {NavigationLink as Link} from '../shell/NavigationLink';
import type {ReactNode} from 'react';
import {statuses,workspaceHref,type WorkspaceQuery,type WorkspaceData} from '../../workspace/model';
import {TasksBoard} from './TasksBoard';
import {TasksList} from './TasksList';
import {TasksFilters} from './TasksFilters';
// TasksMain's vertical filter/board composition; operational links and list are JUYU additions.
type WorkspaceProps={data?:WorkspaceData;error?:string;query?:WorkspaceQuery;retryHref?:string;account?:ReactNode;features?:FeatureFlags};
export function TasksWorkspace(props:WorkspaceProps){return <TasksWorkspaceContent key={JSON.stringify([props.data,props.query,props.error])} {...props}/>;}
function TasksWorkspaceContent({data:initialData,error,query,retryHref='/admin'}:WorkspaceProps){
 const [data,setData]=useState(initialData);
 const [notice,setNotice]=useState<{text:string;batch?:boolean}|null>(null);
 const [reloadError,setReloadError]=useState('');
 const [reading,setReading]=useState(false);
 const [stale,setStale]=useState(false);
 const activeRead=useRef<AbortController|null>(null);
 const currentQuery=useRef(initialData?.query);
 const withdrawals=useRef<BulkWithdrawResult['items']>([]);

 const reload=useCallback(async(invalidate:boolean)=>{
  if(!currentQuery.current)return;
  activeRead.current?.abort();
  const controller=new AbortController();
  activeRead.current=controller;
  if(invalidate)setStale(true);
  setReading(true);setReloadError('');
  try{
   const next=await readWithdrawWorkspace(currentQuery.current,withdrawals.current,controller.signal);
   if(controller.signal.aborted)return;
   currentQuery.current=next.query;
   withdrawals.current=[];
   setData(next);setStale(false);
  }catch(error){
   if(controller.signal.aborted)return;
   setReloadError('列表暂时无法重新读取，请重试以核对最新状态。');
   throw error;
  }finally{
   if(activeRead.current===controller){activeRead.current=null;setReading(false);}
  }
 },[]);

 useEffect(()=>{
  let deferred=false;
  const refresh=()=>{
   // Keep active confirmation dialogs and their retry controls reachable.
   if(document.querySelector('dialog[open]')){deferred=true;return;}
   deferred=false;
   void reload(true).catch(()=>{});
  };
  const dialogClosed=()=>{if(deferred)refresh();};
  const storage=(event:StorageEvent)=>{if(event.key===workspaceChangeKey)refresh();};
  const restored=(event:PageTransitionEvent)=>{if(event.persisted)refresh();};
  const visible=()=>{if(document.visibilityState==='visible')refresh();};
  if(workspaceChangedSinceLoad())refresh();
  window.addEventListener('storage',storage);
  window.addEventListener('pageshow',restored);
  window.addEventListener('popstate',refresh);
  document.addEventListener('visibilitychange',visible);
  document.addEventListener('close',dialogClosed,true);
  return ()=>{
   window.removeEventListener('storage',storage);
   window.removeEventListener('pageshow',restored);
   window.removeEventListener('popstate',refresh);
   document.removeEventListener('visibilitychange',visible);
   document.removeEventListener('close',dialogClosed,true);
   const controller=activeRead.current;
   activeRead.current=null;
   controller?.abort();
  };
 },[reload]);

 async function withdrawn(result:BulkWithdrawResult){
  withdrawals.current=result.items;
  setNotice({text:`已撤回 ${result.items.length} 份资料，均回到草稿；已有正式版继续保留。`,batch:true});
  notifyWorkspaceChange();
  await reload(true).catch(()=>{});
 }
 async function draftChanged(action:'trash'|'discard'){
  setNotice({text:action==='trash'?'草稿已移入回收站。':'已放弃本次修订，正式版继续可读。'});
  await reload(true).catch(()=>{});
 }

 const kind=data?.query.kind??query?.kind;const qa=kind==='qa';const name=qa?'Q&A 管理':kind==='ops'?'OPS 内容管理':kind==='article'?'知识文章管理':kind==='reference'?'Reference 管理':'内容管理';
 return <main id="main-content" className="tasks-workspace tasks-catalog-workspace" data-workspace-view={data?.query.view}>
 <div className="tasks-heading"><div><h1>{name}</h1><p>{qa?'编辑问题与标准答案，审核后发布。分类与排序在问答设置中修改。':'编辑、审核和发布团队的正式资料。'}</p></div><Link prefetch={false} className="primary-link" href={qa?'/admin/editor?kind=qa':kind==='ops'?'/admin/editor?kind=ops':kind==='reference'?'/admin/editor?kind=reference':'/admin/editor'}>＋ {qa?'新建问答':kind==='ops'?'新建运营资料':kind==='reference'?'新建速查资料':'新建文章'}</Link></div>
 {data&&<nav className="workspace-tabs" aria-label="内容范围">{([['all','全部内容'],['submitted','我提交的'],['review','待我审核'],['returned','退回给我的']] as const).map(([scope,label])=>{
  const current=data.query.scope===scope?'page':undefined;
  const scopeStatus=scope==='review'?'in_review':scope==='returned'?'changes_requested':undefined;
  const href=workspaceHref(data.query,{scope,page:1,...(scopeStatus&&data.query.status!==scopeStatus?{status:'all'}:{})});
  return scopeStatus?<a key={scope} aria-current={current} href={href}>{label}</a>:<Link prefetch={false} key={scope} aria-current={current} href={href}>{label}</Link>;
 })}</nav>}
 {!data?<section className="tasks-error" role="status"><h2>内容暂时无法读取</h2><p>{error??'请稍后重试，或检查服务连接。'}</p><Link prefetch={false} href={retryHref}>重新读取内容</Link></section>:<>
 <TasksFilters query={data.query}/>{notice&&<p role="status" aria-label={notice.batch?'批量操作结果':'操作结果'} className="workspace-batch-notice">{notice.text}</p>}{stale&&reading&&<p role="status">正在读取最新列表和数量…</p>}{reloadError&&<div className="workspace-batch-error"><p role="alert">{reloadError}</p><button type="button" disabled={reading} onClick={()=>void reload(stale).catch(()=>{})}>{reading?'正在读取…':'重新读取列表'}</button></div>}<div hidden={stale} aria-busy={reading}><p className="tasks-workflow-note">下列数字按当前工作版状态统计；草稿或审核中的资料如已有正式版，员工仍可阅读旧正式版。</p>
 <nav className="task-status-filters" aria-label="按状态查看">{statuses.map(status=><Link prefetch={false} key={status.id} className={`task-state state-${status.id}`} aria-current={data.query.status===status.id?'page':undefined} href={workspaceHref(data.query,{status:status.id,page:1})}>{status.name}<strong>{data.counts[status.id]}</strong></Link>)}</nav>
 <div className="tasks-results"><p role="status" aria-label="筛选结果">共 {data.total} {qa?'个问题':'篇'} · 第 {data.page} / {data.pages} 页 · 本页 {data.items.length} {qa?'个问题':'篇'}</p><nav className="tasks-view-switch" aria-label="显示方式"><Link prefetch={false} aria-current={data.query.view==='cards'?'page':undefined} href={workspaceHref(data.query,{view:'cards'})}>卡片</Link><Link prefetch={false} aria-current={data.query.view==='board'?'page':undefined} href={workspaceHref(data.query,{view:'board'})}>看板</Link><Link prefetch={false} aria-current={data.query.view==='list'?'page':undefined} href={workspaceHref(data.query,{view:'list'})}>列表</Link></nav><span className="tasks-mobile-label">手机列表</span></div>

 {data.query.scope!=='all'&&<p className="tasks-count-note">个人筛选对应当前工作版本的提交或指派；历史提交记录可在文章的“历史记录与版本”中查看。</p>}
 {data.total===0&&<section className="tasks-empty"><h2>没有符合条件的内容</h2><p>可以清除筛选重新查看。尚未创建内容时，这里会保持空白。</p></section>}
 {data.total>0&&
 data.query.view==='board'&&<div className="tasks-desktop-board"><TasksBoard data={data}/></div>}
 {Boolean(initialData?.items.length||data.items.length)&&<div hidden={data.total===0}><div className={data.query.view==='board'?'tasks-mobile-list':'tasks-all-list'}><TasksList data={data} onWithdrawn={withdrawn} onDraftChanged={draftChanged} onReload={()=>reload(false)}/></div></div>}
 <nav className="search-pagination" aria-label="内容分页">{data.page>1&&<Link prefetch={false} href={workspaceHref(data.query,{page:data.page-1})}>上一页</Link>}<span>第 {data.page} / {data.pages} 页</span>{data.page<data.pages&&<Link prefetch={false} href={workspaceHref(data.query,{page:data.page+1})}>下一页</Link>}</nav></div>
 </>}
 </main>;
}
