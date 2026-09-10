import type {FeatureFlags} from '../../features/model';
/* eslint-disable @next/next/no-html-link-for-pages -- Workspace operational entries use full requests to refresh current member permissions. */
import type {ReactNode} from 'react';
import {statuses,workspaceHref,type WorkspaceData} from '../../workspace/model';
import {TasksBoard} from './TasksBoard';
import {TasksList} from './TasksList';
import {TasksFilters} from './TasksFilters';
// TasksMain's vertical filter/board composition; operational links and list are JUYU additions.
export function TasksWorkspace({data,error,account,features}:{data?:WorkspaceData;error?:string;account?:ReactNode;features?:FeatureFlags}){
 return <main id="main-content" className="tasks-workspace">
 <div className="tasks-heading"><div><p className="card-kicker">CONTENT WORKSPACE</p><h1>内容管理</h1><p>查看内容进度，找到下一篇需要处理的资料。</p></div>{account}</div>
 <div className="tasks-primary-actions"><a href="/admin/editor">新建文章</a><a href="/help-centre">员工资料库 ↗</a><details className="tasks-tools-disclosure"><summary>更多管理工具</summary><nav className="tasks-tools" aria-label="管理工具"><a href="/admin/trash">回收站</a><a href="/admin/availability">归档资料</a><a href="/admin/history">永久删除记录</a><a href="/admin/media">媒体与内容块</a>{features?.feedback!==false&&<a href="/admin/feedback">文章反馈</a>}{features?.analytics!==false&&<a href="/admin/analytics">使用分析</a>}{features?.forms!==false&&<a href="/admin/settings/forms">自定义表单设置</a>}{features?.forms!==false&&<a href="/admin/forms">表单提交记录</a>}<a href="/admin/announcements">新功能公告</a><a href="/admin/settings/history">设置变更记录</a><a href="/admin/settings/features">功能开关</a><a href="/admin/settings/navigation">导航设置</a><a href="/admin/settings/categories">分类设置</a><a href="/admin/settings/fields">自定义字段设置</a><a href="/admin/members">成员与权限</a></nav></details></div>
 <p className="tasks-guidance">内容二审需要另一位管理员。点击文章标题可编辑；在二审详情安排发布。修改已发布文章会生成新草稿，旧正式版继续可读。</p>
 {!data?<section className="tasks-error" role="status"><h2>内容暂时无法读取</h2><p>{error??'请稍后重试，或检查服务连接。'}</p><a href="/admin">重新读取内容</a></section>:<>
 <TasksFilters query={data.query}/>
 <nav className="task-status-filters" aria-label="按状态查看">{statuses.map(status=><a key={status.id} className={`task-state state-${status.id}`} aria-current={data.query.status===status.id?'page':undefined} href={workspaceHref(data.query,{status:status.id,page:1})}>{status.name}<strong>{data.counts[status.id]}</strong></a>)}</nav>
 <div className="tasks-results"><p role="status">共 {data.total} 篇 · 第 {data.page} / {data.pages} 页 · 本页 {data.items.length} 篇</p><nav className="tasks-view-switch" aria-label="显示方式"><a aria-current={data.query.view==='board'?'page':undefined} href={workspaceHref(data.query,{view:'board'})}>看板</a><a aria-current={data.query.view==='list'?'page':undefined} href={workspaceHref(data.query,{view:'list'})}>列表</a></nav><span className="tasks-mobile-label">手机列表</span></div>
 <p className="tasks-count-note">状态数量按标题、类型和个人范围统计；看板每页最多显示 30 篇。可按状态筛选查看该列内容。</p>
 {data.query.scope!=='all'&&<p className="tasks-count-note">个人筛选对应当前工作版本的提交或指派；历史提交记录可在文章的“历史记录与版本”中查看。</p>}
 {data.total===0?<section className="tasks-empty"><h2>没有符合条件的内容</h2><p>可以清除筛选重新查看。尚未创建内容时，这里会保持空白。</p></section>:<>
 {data.query.view==='board'&&<div className="tasks-desktop-board"><TasksBoard data={data}/></div>}
 <div className={data.query.view==='board'?'tasks-mobile-list':'tasks-all-list'}><TasksList data={data}/></div>
 </>}
 <nav className="search-pagination" aria-label="内容分页">{data.page>1&&<a href={workspaceHref(data.query,{page:data.page-1})}>上一页</a>}<span>第 {data.page} / {data.pages} 页</span>{data.page<data.pages&&<a href={workspaceHref(data.query,{page:data.page+1})}>下一页</a>}</nav>
 </>}
 </main>;
}
