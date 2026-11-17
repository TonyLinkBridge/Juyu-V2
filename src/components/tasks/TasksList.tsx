'use client';
import Link from 'next/link';
import {useId,useRef,useState} from 'react';
import {statuses,kinds,type WorkspaceData} from '../../workspace/model';
import {sendBulkWithdraw,BulkWithdrawRejected,bulkWithdrawError} from '../../review/bulk-withdraw-client';
import type {BulkWithdrawInput,BulkWithdrawResult} from '../../review/bulk-withdraw';
import {useReviewLeaveGuard} from '../review/useReviewLeaveGuard';
import type {WorkspaceItem} from '../../workspace/model';
import {DraftRowAction} from './DraftRowAction';
import {TaskCategories} from './TaskCategories';
export function TasksList({data,onWithdrawn,onReload}:{data:WorkspaceData;onWithdrawn?:(result:BulkWithdrawResult)=>Promise<void>;onReload?:()=>Promise<void>}){
 const canBulkWithdraw=data.canBulkWithdraw===true;
 const dialog=useRef<HTMLDialogElement>(null),dialogTitle=useId(),operation=useRef(false),pending=useRef<BulkWithdrawInput|null>(null);
 const [chosen,setChosen]=useState<WorkspaceItem[]>([]),[confirmRows,setConfirmRows]=useState<WorkspaceItem[]>([]),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[blocked,setBlocked]=useState(false),[error,setError]=useState(''),[withdrawals,setWithdrawals]=useState<Record<string,number>>({});
 useReviewLeaveGuard({dirty:chosen.length>0||confirmRows.length>0,busy,uncertain});

 const [completed,setCompleted]=useState<Record<string,{action:'trash'|'discard';sequence:number;updatedAt:string}>>({});
 const items=data.items.flatMap(task=>{
  const result=completed[task.id];
  if(result?.action==='trash')return [];
  if(result?.action==='discard')return [{...task,sequence:result.sequence,status:'published' as const,revision:task.publishedRevision!,categoryPaths:task.publishedCategoryPaths??[],updatedAt:result.updatedAt}];
  if(withdrawals[task.id]!==undefined&&task.sequence<=withdrawals[task.id])return [{...task,sequence:withdrawals[task.id],status:'draft' as const,submitter:null,reviewer:null,canReview:false,canWithdrawSubmission:false}];
  return [task];
 });
 const eligible=canBulkWithdraw?items.filter(task=>task.status==='in_review'):[];
 const selected=chosen.filter(task=>eligible.some(row=>row.id===task.id&&row.sequence===task.sequence&&row.revision===task.revision&&row.publishedRevision===task.publishedRevision));
 const locked=busy||uncertain;const all=eligible.length>0&&selected.length===eligible.length;
 function choose(task:WorkspaceItem,checked:boolean){if(locked)return;setChosen(current=>checked?[...current.filter(row=>row.id!==task.id),task]:current.filter(row=>row.id!==task.id));}
 function open(){if(!selected.length||operation.current||blocked)return;setConfirmRows(selected);pending.current=null;setError('');dialog.current?.showModal();}
 function close(){if(locked)return;setConfirmRows([]);setError('');dialog.current?.close();}
 async function confirm(){if(!canBulkWithdraw||operation.current||blocked&&!uncertain)return;operation.current=true;setBusy(true);setError('');
  const input=pending.current??{items:confirmRows.map(row=>({documentId:row.id,expectedSequence:row.sequence,revision:row.revision,publishedRevision:row.publishedRevision}))};pending.current=input;
  try{const result=await sendBulkWithdraw(input);setWithdrawals(current=>({...current,...Object.fromEntries(result.items.map(row=>[row.documentId,row.sequence]))}));setChosen([]);setConfirmRows([]);setUncertain(false);setBlocked(false);pending.current=null;dialog.current?.close();try{await onWithdrawn?.(result);}catch{/* Parent keeps the confirmed success notice and offers a read-only refresh. */}}
  catch(e){const definite=e instanceof BulkWithdrawRejected;setBlocked(definite);setUncertain(!definite);setError(uncertain&&definite?'原批次结果仍需核对，当前请求已被拒绝。请重新读取列表及历史记录，不要直接重复撤回。':bulkWithdrawError(e));}
  finally{operation.current=false;setBusy(false);}
 }
 async function refresh(){if(operation.current||uncertain)return;operation.current=true;setBusy(true);try{await onReload?.();setChosen([]);setConfirmRows([]);pending.current=null;setBlocked(false);dialog.current?.close();}catch{setError('列表读取失败，操作已暂停。请稍后重试。');}finally{operation.current=false;setBusy(false);}}
 return <>
 {canBulkWithdraw&&<>
 <div className="workspace-batch-toolbar" role="group" aria-label="当前页批量撤回">
  <label><input type="checkbox" aria-label="全选本页等待审核资料" disabled={locked||blocked||eligible.length===0} checked={all} ref={node=>{if(node)node.indeterminate=selected.length>0&&!all;}} onChange={event=>setChosen(event.target.checked?eligible:[])}/>全选本页待审资料</label>
  <span>已选 {selected.length} 份 · 仅当前页，最多 30 份</span><button type="button" className="secondary-link" disabled={locked||blocked||selected.length===0} onClick={open}>批量撤回送审</button>{blocked&&!uncertain&&confirmRows.length===0&&<button type="button" className="secondary-link" disabled={busy} onClick={()=>void refresh()}>{busy?'正在读取…':'重新读取列表'}</button>}
 </div>
 <dialog ref={dialog} className="juyu-confirm workspace-batch-dialog" aria-labelledby={dialogTitle} onCancel={event=>{if(locked)event.preventDefault();else{setConfirmRows([]);setError('');}}}>
  <h2 id={dialogTitle}>撤回这 {confirmRows.length} 份资料的送审？</h2><p>全部回到草稿，正文与历史记录保留，已有正式版继续保留。本次不填写退回原因，也不会自动发布。</p><p>其中一份的版本或状态发生变化时，整批不执行，请重新核对。</p>
  <ul className="workspace-batch-selection">{confirmRows.map(row=><li key={row.id}><strong>{row.title}</strong><span>{kinds[row.kind]} · 工作修订 {row.revision} · 提交人：{row.submitter??'未记录'}</span></li>)}</ul>
  {error&&<p role="alert" className="task-draft-error">{error}</p>}
  <div className="juyu-confirm-actions"><button type="button" disabled={locked} onClick={close}>取消</button>{blocked&&!uncertain?<button type="button" disabled={busy} onClick={()=>void refresh()}>重新读取列表</button>:null}<button type="button" className="editor-delete-trigger" disabled={busy||blocked&&!uncertain||confirmRows.length===0} onClick={()=>void confirm()}>{busy?'正在撤回…':uncertain?'重试原批次':`确认撤回 ${confirmRows.length} 份`}</button></div>
 </dialog></>}
 <div className="workspace-table-wrap"><table className="workspace-table"><caption className="sr-only">内容列表</caption><thead><tr><th>标题</th><th>状态</th><th>提交人</th><th>二审人</th><th>更新时间</th><th>操作</th></tr></thead><tbody>{items.map(task=>{
 const href=`/admin/${task.status==='in_review'?'review':task.status==='approved'||task.status==='queued'?'review/publish':'editor'}?article=${encodeURIComponent(task.id)}`;
 const actionHref=task.status==='approved'||task.status==='queued'?`${href}&intent=publish_now`:href;
 return <tr key={task.id}><td data-label="标题">{canBulkWithdraw&&task.status==='in_review'&&<label className="workspace-select-row"><input type="checkbox" aria-label={`选择资料：${task.title}`} disabled={locked||blocked} checked={selected.some(row=>row.id===task.id)} onChange={event=>choose(task,event.target.checked)}/>选择</label>}<Link prefetch={false} href={href}><strong>{task.title}</strong></Link><small>{kinds[task.kind]} · 工作修订 {task.revision}</small><TaskCategories task={task}/></td><td data-label="状态"><span className={`task-state state-${task.status}`}>{statuses.find(s=>s.id===task.status)!.name}</span>{task.publishedRevision!==null&&task.status!=='published'&&<small>旧正式版继续可读</small>}</td><td data-label="提交人">{task.submitter??'尚未提交'}</td><td data-label="二审人">{task.reviewer??'尚未指定'}</td><td data-label="更新时间"><time dateTime={task.updatedAt}>{new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Kuala_Lumpur',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(task.updatedAt))}</time></td><td data-label="操作"><div className="task-row-actions"><Link prefetch={false} className={task.status==='in_review'?'task-review-action':'secondary-link'} href={actionHref}>{task.status==='in_review'?(task.canReview||data.query.scope==='review'?'处理审核':'查看审核'):task.status==='approved'||task.status==='queued'?'立即发布':task.kind==='qa'?'编辑问答':'编辑文章'}</Link>{task.status==='in_review'&&task.canWithdrawSubmission===true&&<Link prefetch={false} className="secondary-link" href={`/admin/review/manage?article=${encodeURIComponent(task.id)}&intent=withdraw`}>撤回送审</Link>}{task.status==='changes_requested'&&<Link prefetch={false} className="secondary-link" href={`/admin/review?article=${encodeURIComponent(task.id)}`}>查看退回原因</Link>}{task.status==='draft'&&<DraftRowAction id={task.id} title={task.title} sequence={task.sequence} publishedRevision={task.publishedRevision} onCompleted={(action,sequence)=>setCompleted(current=>({...current,[task.id]:{action,sequence,updatedAt:new Date().toISOString()}}))}/>}</div></td></tr>;
 })}</tbody></table></div></>;
}
