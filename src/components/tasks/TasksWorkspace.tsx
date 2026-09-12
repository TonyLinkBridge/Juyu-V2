import type {FeatureFlags} from '../../features/model';
import {NavigationLink as Link} from '../shell/NavigationLink';
import type {ReactNode} from 'react';
import {statuses,workspaceHref,type WorkspaceData} from '../../workspace/model';
import {TasksBoard} from './TasksBoard';
import {TasksList} from './TasksList';
import {TasksFilters} from './TasksFilters';
// TasksMain's vertical filter/board composition; operational links and list are JUYU additions.
export function TasksWorkspace({data,error}:{data?:WorkspaceData;error?:string;account?:ReactNode;features?:FeatureFlags}){
 const kind=data?.query.kind;const qa=kind==='qa';const name=qa?'Q&A 管理':kind==='ops'?'OPS 内容管理':kind==='article'?'知识文章管理':'内容管理';
 return <main id="main-content" className="tasks-workspace">
 <div className="tasks-heading"><div><h1>{name}</h1><p>编辑、审核和发布团队的正式资料。</p></div><Link prefetch={false} className="primary-link" href={qa?'/admin/editor?kind=qa':kind==='ops'?'/admin/editor?kind=ops':kind==='reference'?'/admin/editor?kind=reference':'/admin/editor'}>＋ {qa?'新建问答':kind==='ops'?'新建运营资料':kind==='reference'?'新建速查资料':'新建文章'}</Link></div>
 <nav className="workspace-tabs" aria-label="内容模块">{[['article','知识文章'],['ops','OPS Internal'],['qa','Q&A 问答'],['reference','Reference 速查']].map(([value,label])=><Link prefetch={false} key={value} href={'/admin?kind='+value+'&view=list'} aria-current={kind===value?'page':undefined}>{label}</Link>)}</nav>
 {data&&<nav className="workspace-tabs" aria-label="内容范围">{[['all','全部内容'],['submitted','我提交的'],['review','待我审核'],['returned','退回给我的']].map(([scope,label])=><Link prefetch={false} key={scope} aria-current={data.query.scope===scope?'page':undefined} href={workspaceHref(data.query,{scope:scope as WorkspaceData['query']['scope'],page:1})}>{label}</Link>)}</nav>}
 {!data?<section className="tasks-error" role="status"><h2>内容暂时无法读取</h2><p>{error??'请稍后重试，或检查服务连接。'}</p><Link prefetch={false} href="/admin">重新读取内容</Link></section>:<>
 <TasksFilters query={data.query}/>
 <nav className="task-status-filters" aria-label="按状态查看">{statuses.map(status=><Link prefetch={false} key={status.id} className={`task-state state-${status.id}`} aria-current={data.query.status===status.id?'page':undefined} href={workspaceHref(data.query,{status:status.id,page:1})}>{status.name}<strong>{data.counts[status.id]}</strong></Link>)}</nav>
 <div className="tasks-results"><p role="status">共 {data.total} 篇 · 第 {data.page} / {data.pages} 页 · 本页 {data.items.length} 篇</p><nav className="tasks-view-switch" aria-label="显示方式"><Link prefetch={false} aria-current={data.query.view==='board'?'page':undefined} href={workspaceHref(data.query,{view:'board'})}>看板</Link><Link prefetch={false} aria-current={data.query.view==='list'?'page':undefined} href={workspaceHref(data.query,{view:'list'})}>列表</Link></nav><span className="tasks-mobile-label">手机列表</span></div>

 {data.query.scope!=='all'&&<p className="tasks-count-note">个人筛选对应当前工作版本的提交或指派；历史提交记录可在文章的“历史记录与版本”中查看。</p>}
 {data.total===0?<section className="tasks-empty"><h2>没有符合条件的内容</h2><p>可以清除筛选重新查看。尚未创建内容时，这里会保持空白。</p></section>:<>
 {data.query.view==='board'&&<div className="tasks-desktop-board"><TasksBoard data={data}/></div>}
 <div className={data.query.view==='board'?'tasks-mobile-list':'tasks-all-list'}><TasksList data={data}/></div>
 </>}
 <nav className="search-pagination" aria-label="内容分页">{data.page>1&&<Link prefetch={false} href={workspaceHref(data.query,{page:data.page-1})}>上一页</Link>}<span>第 {data.page} / {data.pages} 页</span>{data.page<data.pages&&<Link prefetch={false} href={workspaceHref(data.query,{page:data.page+1})}>下一页</Link>}</nav>
 </>}
 </main>;
}
