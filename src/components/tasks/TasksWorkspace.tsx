'use client';
import {useState} from 'react';
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
 const [data,setData]=useState(initialData),[batchNotice,setBatchNotice]=useState(''),[reloadError,setReloadError]=useState(''),[reading,setReading]=useState(false),[completed,setCompleted]=useState<BulkWithdrawResult['items']>([]);
 async function reload(ack=completed){if(!data)return;setReading(true);setReloadError('');try{setData(await readWithdrawWorkspace(data.query,ack));}catch{setReloadError(ack.length?'列表暂时无法重新读取。上次已确认的撤回仍然有效，请重新读取列表核对最新状态。':'列表暂时无法重新读取，请稍后重试；本页没有新的撤回成功确认。');throw new Error('READ_FAILED');}finally{setReading(false);}}
 async function withdrawn(result:BulkWithdrawResult){setBatchNotice(`已撤回 ${result.items.length} 份资料，均回到草稿；已有正式版继续保留。`);setCompleted(result.items);await reload(result.items);}

 const kind=data?.query.kind??query?.kind;const qa=kind==='qa';const name=qa?'Q&A 管理':kind==='ops'?'OPS 内容管理':kind==='article'?'知识文章管理':kind==='reference'?'Reference 管理':'内容管理';
 return <main id="main-content" className="tasks-workspace">
 <div className="tasks-heading"><div><h1>{name}</h1><p>{qa?'编辑问题与标准答案，审核后发布。分类与排序在问答设置中修改。':'编辑、审核和发布团队的正式资料。'}</p></div><Link prefetch={false} className="primary-link" href={qa?'/admin/editor?kind=qa':kind==='ops'?'/admin/editor?kind=ops':kind==='reference'?'/admin/editor?kind=reference':'/admin/editor'}>＋ {qa?'新建问答':kind==='ops'?'新建运营资料':kind==='reference'?'新建速查资料':'新建文章'}</Link></div>
 {data&&<nav className="workspace-tabs" aria-label="内容范围">{[['all','全部内容'],['submitted','我提交的'],['review','待我审核'],['returned','退回给我的']].map(([scope,label])=><Link prefetch={false} prefetchOnIntent key={scope} aria-current={data.query.scope===scope?'page':undefined} href={workspaceHref(data.query,{scope:scope as WorkspaceData['query']['scope'],page:1})}>{label}</Link>)}</nav>}
 {!data?<section className="tasks-error" role="status"><h2>内容暂时无法读取</h2><p>{error??'请稍后重试，或检查服务连接。'}</p><Link prefetch={false} href={retryHref}>重新读取内容</Link></section>:<>
 <TasksFilters query={data.query}/>{batchNotice&&<p role="status" aria-label="批量操作结果" className="workspace-batch-notice">{batchNotice}</p>}{reloadError&&<div className="workspace-batch-error"><p role="alert">{reloadError}</p><button type="button" disabled={reading} onClick={()=>void reload().catch(()=>{})}>{reading?'正在读取…':'重新读取列表'}</button></div>}<p className="tasks-workflow-note">下列数字按当前工作版状态统计；草稿或审核中的资料如已有正式版，员工仍可阅读旧正式版。</p>
 <nav className="task-status-filters" aria-label="按状态查看">{statuses.map(status=><Link prefetch={false} key={status.id} className={`task-state state-${status.id}`} aria-current={data.query.status===status.id?'page':undefined} href={workspaceHref(data.query,{status:status.id,page:1})}>{status.name}<strong>{data.counts[status.id]}</strong></Link>)}</nav>
 <div className="tasks-results"><p role="status" aria-label="筛选结果">共 {data.total} {qa?'个问题':'篇'} · 第 {data.page} / {data.pages} 页 · 本页 {data.items.length} {qa?'个问题':'篇'}</p><nav className="tasks-view-switch" aria-label="显示方式"><Link prefetch={false} aria-current={data.query.view==='board'?'page':undefined} href={workspaceHref(data.query,{view:'board'})}>看板</Link><Link prefetch={false} aria-current={data.query.view==='list'?'page':undefined} href={workspaceHref(data.query,{view:'list'})}>列表</Link></nav><span className="tasks-mobile-label">手机列表</span></div>

 {data.query.scope!=='all'&&<p className="tasks-count-note">个人筛选对应当前工作版本的提交或指派；历史提交记录可在文章的“历史记录与版本”中查看。</p>}
 {data.total===0?<section className="tasks-empty"><h2>没有符合条件的内容</h2><p>可以清除筛选重新查看。尚未创建内容时，这里会保持空白。</p></section>:<>
 {data.query.view==='board'&&<div className="tasks-desktop-board"><TasksBoard data={data}/></div>}
 <div className={data.query.view==='board'?'tasks-mobile-list':'tasks-all-list'}><TasksList key={workspaceHref(data.query)} data={data} onWithdrawn={withdrawn} onReload={()=>reload()}/></div>
 </>}
 <nav className="search-pagination" aria-label="内容分页">{data.page>1&&<Link prefetch={false} href={workspaceHref(data.query,{page:data.page-1})}>上一页</Link>}<span>第 {data.page} / {data.pages} 页</span>{data.page<data.pages&&<Link prefetch={false} href={workspaceHref(data.query,{page:data.page+1})}>下一页</Link>}</nav>
 </>}
 </main>;
}