'use client';
import Link from 'next/link';
import {useState} from 'react';
import {statuses,kinds,type WorkspaceData} from '../../workspace/model';
import {DraftRowAction} from './DraftRowAction';
export function TasksList({data}:{data:WorkspaceData}){
 const [completed,setCompleted]=useState<Record<string,{action:'trash'|'discard';sequence:number;updatedAt:string}>>({});
 const items=data.items.flatMap(task=>{
  const result=completed[task.id];
  if(result?.action==='trash')return [];
  if(result?.action==='discard')return [{...task,sequence:result.sequence,status:'published' as const,revision:task.publishedRevision!,updatedAt:result.updatedAt}];
  return [task];
 });
 return <div className="workspace-table-wrap"><table className="workspace-table"><caption className="sr-only">内容列表</caption><thead><tr><th>标题</th><th>状态</th><th>提交人</th><th>二审人</th><th>更新时间</th><th>操作</th></tr></thead><tbody>{items.map(task=>{
 const href=`/admin/${task.status==='in_review'?'review':task.status==='approved'||task.status==='queued'?'review/publish':'editor'}?article=${encodeURIComponent(task.id)}`;
 return <tr key={task.id}><td data-label="标题"><Link prefetch={false} href={href}><strong>{task.title}</strong></Link><small>{kinds[task.kind]} · 工作修订 {task.revision}</small>{task.kind==='qa'&&<small>分类：{task.qaCategory||'未分类'} · 排序：{task.qaPosition??0}（数字越小越靠前）</small>}</td><td data-label="状态"><span className={`task-state state-${task.status}`}>{statuses.find(s=>s.id===task.status)!.name}</span>{task.publishedRevision!==null&&task.status!=='published'&&<small>旧正式版继续可读</small>}</td><td data-label="提交人">{task.submitter??'尚未提交'}</td><td data-label="二审人">{task.reviewer??'尚未指定'}</td><td data-label="更新时间"><time dateTime={task.updatedAt}>{new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Kuala_Lumpur',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(task.updatedAt))}</time></td><td data-label="操作"><div className="task-row-actions"><Link prefetch={false} className={task.status==='in_review'?'task-review-action':'secondary-link'} href={href}>{task.status==='in_review'?(task.canReview||data.query.scope==='review'?'处理审核':'查看审核'):task.status==='approved'||task.status==='queued'?'安排发布':task.kind==='qa'?'编辑问答':'编辑文章'}</Link>{task.status==='draft'&&<DraftRowAction id={task.id} title={task.title} sequence={task.sequence} publishedRevision={task.publishedRevision} onCompleted={(action,sequence)=>setCompleted(current=>({...current,[task.id]:{action,sequence,updatedAt:new Date().toISOString()}}))}/>}</div></td></tr>;
 })}</tbody></table></div>;
}
