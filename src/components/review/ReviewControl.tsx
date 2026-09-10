'use client';
import {useRef,useState} from 'react';
import type {ControlDetail,ControlInput} from '../../review/control';
import {ControlRejected,controlError,readControl,sendControl} from '../../review/control-client';
type Pending={input:ControlInput;revision:number;previousReviewerId:string;targetName:string};
const statuses={draft:'草稿',in_review:'审核中',changes_requested:'需要修改',approved:'已经批准',queued:'等待发布',published:'已发布'};
const actions:Record<string,string>={submit:'提交二审',withdraw:'撤回审核',reassign:'改派二审',approve:'批准版本',reject:'退回修改'};
export function ReviewControl({initial}:{initial:ControlDetail}){
 const [detail,setDetail]=useState(initial);const [action,setAction]=useState<ControlInput['action']|null>(null);const [target,setTarget]=useState('');
 const [busy,setBusy]=useState<'read'|'more'|'write'|''>('');const [uncertain,setUncertain]=useState(false);const [blocked,setBlocked]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');const [confirmedUnread,setConfirmedUnread]=useState(false);
 const operation=useRef(false);const pending=useRef<Pending|null>(null);const minimumSequence=useRef(initial.sequence);
 const eligible=detail.canManageReview&&detail.lifecycle==='active'&&detail.status==='in_review'&&Boolean(detail.reviewerId);const locked=Boolean(busy)||uncertain;const chosen=detail.reviewers.find(x=>x.id===target);const canConfirm=action==='withdraw'||Boolean(chosen);
 async function reload(more=false){if(operation.current||uncertain||more&&(!detail.nextCursor||blocked))return;operation.current=true;setBusy(more?'more':'read');setError('');setBlocked(true);
  try{const next=await readControl(detail.documentId,minimumSequence.current,more?detail.nextCursor!:'');if(more&&(next.sequence!==detail.sequence||next.revision!==detail.revision||next.reviewerId!==detail.reviewerId||next.status!==detail.status||next.lifecycle!==detail.lifecycle))throw new Error('READ_FAILED');
   if(more){const merged=new Map(detail.reviewers.map(x=>[x.id,x]));for(const person of next.reviewers)merged.set(person.id,person);setDetail({...next,reviewers:[...merged.values()]});}else{setDetail(next);setAction(null);setTarget('');setConfirmedUnread(false);}
   minimumSequence.current=next.sequence;setBlocked(false);
  }catch(e){setError(controlError(e,true));}finally{operation.current=false;setBusy('');}
 }
 async function change(){if(operation.current||(!uncertain&&(!eligible||blocked||!action||!canConfirm)))return;
  const exact=pending.current??{input:{expectedSequence:detail.sequence,action:action!,...(action==='reassign'?{reviewerId:target}:{})},revision:detail.revision,previousReviewerId:detail.reviewerId!,targetName:chosen?.name??''};
  pending.current=exact;operation.current=true;setBusy('write');setError('');
  try{const ack=await sendControl(detail.documentId,exact.input,exact.revision,exact.previousReviewerId);minimumSequence.current=ack.sequence;pending.current=null;setUncertain(false);setAction(null);setTarget('');setBlocked(true);setConfirmedUnread(true);setNotice(ack.action==='withdraw'?'已确认撤回，本次版本已回到草稿，不会自动发布。':`已确认改派给 ${exact.targetName}，仍审核同一送审版本，不会自动发布。`);
   setBusy('read');try{const next=await readControl(detail.documentId,ack.sequence);setDetail(next);minimumSequence.current=next.sequence;setBlocked(false);setConfirmedUnread(false);}catch(e){setError(controlError(e,true));}
  }catch(e){const unknown=uncertain||!(e instanceof ControlRejected);setUncertain(unknown);if(!unknown){pending.current=null;setBlocked(true);}setError(controlError(unknown?new Error('UNKNOWN_RESULT'):e));}finally{operation.current=false;setBusy('');}
 }
 return <section className="review-decision review-control" aria-label="本次审核管理">
  <nav className="review-decision-links" aria-label="审核管理导航">{!locked&&<><a href={`/admin/review?article=${encodeURIComponent(detail.documentId)}`}>返回二审详情</a><a href={`/admin/editor?article=${encodeURIComponent(detail.documentId)}`}>编辑文章</a><a href="/admin">返回内容工作台</a></>}<button type="button" disabled={locked} onClick={()=>void reload()}>{busy==='read'?'正在读取…':'重新读取审核状态'}</button></nav>
  <header><p className="review-decision-eyebrow">审核管理 · 版本 {detail.revision}</p><h2>{detail.title}</h2><p>当前状态：{statuses[detail.status]}</p><dl className="review-decision-metadata"><div><dt>{detail.status==='in_review'?'冻结的送审版本':'当前版本'}</dt><dd>版本 {detail.revision}</dd></div><div><dt>当前二审管理员</dt><dd>{detail.reviewerName??'未指定'}</dd></div></dl><p>{detail.publishedRevision===null?'尚未发布。':`已有正式版 ${detail.publishedRevision} 继续可读。`}撤回或改派不会改变已有正式版。</p>{detail.status==='in_review'&&<p>送审内容保持冻结；改派只更换二审管理员。需要修改内容时，请先撤回。</p>}{detail.status==='in_review'&&!detail.reviewerAvailable&&<p className="review-control-warning">原二审管理员已不可用，当前 Admin 仍可撤回或改派本次审核。</p>}</header>
  <section className="review-decision-controls" aria-label="审核管理操作">{notice&&<p role="status">{notice}</p>}{confirmedUnread&&<p>操作已经确认。本页显示的文章状态和记录仍是上次读取结果，最新资料待重新读取。</p>}
   {!eligible&&<p>{detail.lifecycle!=='active'?'文章已停用，不能管理本次审核。':!detail.canManageReview&&detail.status==='in_review'?'当前账号没有管理本次审核的权限。':'当前没有进行中的审核，不能撤回或改派。'}</p>}
   {eligible&&(!action?<div className="review-decision-actions"><button type="button" disabled={locked||blocked} onClick={()=>setAction('withdraw')}>撤回本次审核</button><button type="button" disabled={locked||blocked} onClick={()=>setAction('reassign')}>改派二审管理员</button></div>:<div className="review-decision-confirm"><h3>{action==='withdraw'?'确认撤回本次审核':'选择新的二审管理员'}</h3><p>本次操作针对送审版本 {detail.revision}。</p>{action==='withdraw'?<p>撤回后回到草稿，不会自动发布。</p>:<><p>新管理员将接手同一份冻结内容；原管理员将不能决定本次审核。</p><label>新的二审管理员<select aria-label="新的二审管理员" disabled={locked||blocked} value={target} onChange={event=>setTarget(event.target.value)}><option value="">请选择管理员</option>{detail.reviewers.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</select></label><p>{detail.nextCursor?`已载入 ${detail.reviewers.length} 位候选管理员，后面仍有候选页。`:detail.reviewers.length?`已载入全部 ${detail.reviewers.length} 位候选管理员。`:'当前没有其他可用的二审管理员。'}</p>{detail.nextCursor&&<button type="button" disabled={locked||blocked} onClick={()=>void reload(true)}>{busy==='more'?'正在载入…':'载入更多候选管理员'}</button>}</>}
    <div className="review-decision-actions"><button type="button" disabled={Boolean(busy)||!uncertain&&(blocked||!canConfirm)} onClick={()=>void change()}>{busy==='write'?'正在提交…':uncertain?'重试原操作':action==='withdraw'?'确认撤回':'确认改派'}</button><button type="button" disabled={locked} onClick={()=>{setAction(null);setTarget('');setError('');}}>取消操作</button></div></div>)}
   {error&&<p role="alert">{error}</p>}
  </section>
  <section className="review-control-history" aria-label="最近审核记录"><h3>最近审核记录</h3><p>已载入 {detail.history.length} 条撤回与改派记录，最多显示最近 20 条。{detail.historyMore?'另有更早记录，本页未载入。':''}</p>{detail.history.length?<ol>{detail.history.map(entry=><li key={entry.sequence}><p><strong>{actions[entry.action]??entry.action}</strong> · 版本 {entry.revision}</p><p>操作人：{entry.actorName}</p>{['submit','reassign','withdraw'].includes(entry.action)&&<p>二审管理员：{entry.previousReviewerName??'未指定'} → {entry.reviewerName??'未指定'}</p>}<time dateTime={entry.at}>{new Date(entry.at).toLocaleString('zh-CN',{timeZone:'Asia/Kuala_Lumpur',hour12:false})}（马来西亚时间）</time></li>)}</ol>:<p>暂无撤回与改派记录。</p>}</section>
 </section>;
}
