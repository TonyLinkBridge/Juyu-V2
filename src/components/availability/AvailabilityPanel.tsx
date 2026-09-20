'use client';
import {useEffect,useRef,useState} from 'react';
import type {AvailabilityDetail,AvailabilityInput} from '../../availability/model';
import {readAvailability,sendAvailability,availabilityError,AvailabilityRejected} from '../../availability/client';
const labels={archive:'归档',unpublish:'下线',unarchive:'恢复为草稿'};
export function AvailabilityPanel({initial}:{initial:AvailabilityDetail}){
 const [detail,setDetail]=useState(initial),[action,setAction]=useState<AvailabilityInput['action']|null>(null),[busy,setBusy]=useState<'read'|'write'|''>('');
 const [uncertain,setUncertain]=useState(false),[blocked,setBlocked]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[confirmedUnread,setConfirmedUnread]=useState(false);
 const operation=useRef(false),pending=useRef<{input:AvailabilityInput;revision:number}|null>(null),minimumSequence=useRef(initial.sequence);
 useEffect(()=>{
  // Refs cover the synchronous request start and keep the exact unresolved
  // operation protected even when the panel's own navigation is hidden.
  const held=()=>operation.current||pending.current!==null;
  const warn=(event:BeforeUnloadEvent)=>{if(held()){event.preventDefault();event.returnValue='';}};
  const link=(event:MouseEvent)=>{if(held()&&event.target instanceof Element&&event.target.closest('a[href]')){event.preventDefault();event.stopPropagation();}};
  window.addEventListener('beforeunload',warn);document.addEventListener('click',link,true);
  return()=>{window.removeEventListener('beforeunload',warn);document.removeEventListener('click',link,true);};
 },[]);
 const locked=Boolean(busy)||uncertain;
 const allowed={archive:detail.canArchive&&detail.lifecycle==='active',unpublish:detail.canUnpublish&&detail.lifecycle==='active'&&detail.publishedRevision!==null,unarchive:detail.canUnarchive&&detail.lifecycle==='archived'};
 async function reload(){if(operation.current||uncertain)return;operation.current=true;setBusy('read');setBlocked(true);setError('');try{const next=await readAvailability(detail.documentId,minimumSequence.current);setDetail(next);minimumSequence.current=next.sequence;setAction(null);setBlocked(false);setConfirmedUnread(false);}catch(e){setError(availabilityError(e,true));}finally{operation.current=false;setBusy('');}}
 async function change(){if(operation.current||!uncertain&&(blocked||!action||!allowed[action]))return;
  const exact=pending.current??{input:{expectedSequence:detail.sequence,action:action!},revision:detail.revision};pending.current=exact;operation.current=true;setBusy('write');setError('');setNotice('');
  try{const ack=await sendAvailability(detail.documentId,exact.input,exact.revision);minimumSequence.current=ack.sequence;pending.current=null;setUncertain(false);setAction(null);setBlocked(true);setConfirmedUnread(true);setNotice(ack.action==='archive'?'文章已归档，员工无法再读取；内容和历史记录仍保留。':ack.action==='unpublish'?'正式版已下线，文章保留为草稿；员工无法再读取。':'文章已恢复为草稿，仍未发布；重新二审和发布后员工才能看到。');setBusy('read');try{const next=await readAvailability(detail.documentId,ack.sequence);setDetail(next);minimumSequence.current=next.sequence;setBlocked(false);setConfirmedUnread(false);}catch(e){setError(availabilityError(e,true));}}
  catch(e){const unknown=uncertain||!(e instanceof AvailabilityRejected);setUncertain(unknown);if(!unknown){pending.current=null;setBlocked(true);}setError(availabilityError(unknown?new Error('UNKNOWN_RESULT'):e));}finally{operation.current=false;setBusy('');}
 }
 return <section className="review-decision" aria-label="归档与下线管理"><nav className="review-decision-links" aria-label="资料管理导航">{!locked&&<><a href="/admin">返回内容工作台</a><a href="/admin/availability">归档资料列表</a><a href={`/admin/history?article=${encodeURIComponent(detail.documentId)}`}>历史记录与版本</a>{detail.lifecycle==='active'&&<a href={`/admin/editor?article=${encodeURIComponent(detail.documentId)}`}>编辑文章</a>}</>}<button type="button" disabled={locked} onClick={()=>void reload()}>{busy==='read'?'正在读取…':'重新读取资料状态'}</button></nav>
 {notice&&<p role="status">{notice}</p>}{confirmedUnread&&<p className="review-control-warning">操作已经确认。本页状态和记录仍是上次读取结果，请重新读取后核对。</p>}
 <header><p className="review-decision-eyebrow">工作修订 {detail.revision} · {{active:'工作台资料',archived:'已归档',trashed:'回收站资料'}[detail.lifecycle]}</p><h2>{detail.title}</h2><p>当前正式版：{detail.publishedRevision===null?'无':`已发布（工作修订 ${detail.publishedRevision}）`}</p><p>下线后文章留在工作台；归档后进入归档列表。两种操作都停止员工通过目录、搜索、图片、文件和 PDF 读取。</p><p>内容和历史记录保留。恢复只回到未发布草稿，不会自动上线。</p></header>
 <section className="review-decision-controls" aria-label="可用状态操作">{!Object.values(allowed).some(Boolean)&&<p>当前资料状态或账号权限不允许归档、下线或恢复。</p>}{!action?<div className="review-decision-actions">{allowed.unpublish&&<button type="button" disabled={locked||blocked} onClick={()=>setAction('unpublish')}>下线正式版</button>}{allowed.archive&&<button type="button" disabled={locked||blocked} onClick={()=>setAction('archive')}>归档文章</button>}{allowed.unarchive&&<button type="button" disabled={locked||blocked} onClick={()=>setAction('unarchive')}>恢复为未发布草稿</button>}</div>:<div className="review-decision-confirm"><h3>{action==='unarchive'?'恢复为未发布草稿':`${labels[action]}“${detail.title}”？`}</h3><p>本次操作针对工作版本 {detail.revision}。{detail.publishedRevision===null?'当前没有正式版。':`正式内容（工作修订 ${detail.publishedRevision}） 将停止对员工提供。`}</p>{action==='unarchive'?<p>内容回到工作台草稿，必须重新提交二审和发布。</p>:<><p>当前审核会结束，批准记录不能用于再次发布。</p><p>已保存的正文、附件及历史记录仍保留。</p></>}<div className="review-decision-actions"><button type="button" disabled={Boolean(busy)||blocked&&!uncertain} onClick={()=>void change()}>{busy==='write'?'正在处理…':uncertain?'重试原操作':`确认${labels[action]}`}</button><button type="button" disabled={locked} onClick={()=>{setAction(null);setError('');}}>取消操作</button></div></div>}{error&&<p role="alert">{error}</p>}</section>
 <section className="review-control-history" aria-label="可用状态记录"><h3>可用状态记录</h3><p>已载入 {detail.history.length} 条记录，最多显示最近 20 条。{detail.historyMore?'另有更早记录，本页未载入。':''}</p>{detail.history.length?<ol>{detail.history.map(h=><li key={h.sequence}><p><strong>{labels[h.action]}</strong> · 工作版本 {h.revision}</p><p>操作人：{h.actorName} · {h.previousPublishedRevision===null?'当时无正式版':`原正式版 ${h.previousPublishedRevision}`}</p><time dateTime={h.at}>{new Date(h.at).toLocaleString('zh-CN',{timeZone:'Asia/Kuala_Lumpur',hour12:false})}（马来西亚时间）</time></li>)}</ol>:<p>暂未记录归档、下线或恢复操作。</p>}</section>
 </section>;
}
