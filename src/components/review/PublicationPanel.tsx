'use client';
import {useReviewLeaveGuard} from './useReviewLeaveGuard';
import {requestReviewLeave} from '../../review/leave';
import {ArticleCategories} from '../categories/ArticleCategories';
import {FieldValues} from '../fields/FieldValues';
/* eslint-disable @next/next/no-img-element -- cover URLs require the current administrator session. */
import {useRef,useState} from 'react';
import type {PublicationDetail,PublicationInput} from '../../review/publication';
import {readPublication,sendPublication,publicationError,PublicationRejected} from '../../review/publication-client';
import {DocumentView} from '../gitbook/Reading/DocumentView';
import {MediaBlocks} from '../gitbook/Media/MediaBlocks';
import {parseReaderBody} from '../../reader/body';
import {kinds,statuses} from '../../workspace/model';
type Pending={input:PublicationInput;revision:number;approvedBy:string;previousPublication:number|null};
const time=(value:string)=>new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Kuala_Lumpur',hour12:false});
export function PublicationPanel({initial}:{initial:PublicationDetail}){
 const [detail,setDetail]=useState(initial),[confirm,setConfirm]=useState<PublicationInput['action']|null>(null);
 const [busy,setBusy]=useState<'read'|'write'|''>(''),[uncertain,setUncertain]=useState(false),[blocked,setBlocked]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[confirmedUnread,setConfirmedUnread]=useState(false),[coverFailed,setCoverFailed]=useState(false);
 const operation=useRef(false),pending=useRef<Pending|null>(null),minimumSequence=useRef(initial.article.sequence);
 const {article,approval,revision}=detail;const locked=Boolean(busy)||uncertain;
 const canQueue=detail.canQueue&&article.status==='approved'&&article.lifecycle==='active'&&approval?.revision===revision;
 const canPublish=detail.canPublish&&article.status==='queued'&&article.lifecycle==='active'&&approval?.revision===revision;
 useReviewLeaveGuard({dirty:confirm!==null&&!blocked,busy:Boolean(busy),uncertain});
 async function reload(){if(operation.current||uncertain)return;if(!(await requestReviewLeave('discard'))||operation.current||uncertain)return;operation.current=true;setBusy('read');setError('');setBlocked(true);
  try{const next=await readPublication(article.documentId,minimumSequence.current);setDetail(next);minimumSequence.current=next.article.sequence;setConfirm(null);setBlocked(false);setConfirmedUnread(false);setCoverFailed(false);}catch(e){setError(publicationError(e,true));}finally{operation.current=false;setBusy('');}
 }
 async function change(){if(operation.current||!uncertain&&(blocked||!confirm||!(confirm==='queue'?canQueue:canPublish)))return;
  const exact=pending.current??{input:{action:confirm!,expectedSequence:article.sequence},revision,approvedBy:approval!.reviewerId,previousPublication:article.publishedRevision};
  pending.current=exact;operation.current=true;setBusy('write');setError('');setNotice('');
  try{const ack=await sendPublication(article.documentId,exact.input,exact.revision,exact.approvedBy,exact.previousPublication);minimumSequence.current=ack.sequence;pending.current=null;setUncertain(false);setConfirm(null);setBlocked(true);setConfirmedUnread(true);setNotice(ack.action==='queue'?`版本 ${ack.revision} 已进入等待发布，仍需管理员确认正式发布。`:`工作修订 ${ack.revision} 已正式发布，具备阅读权限的员工可以查阅。`);
   setBusy('read');try{const next=await readPublication(article.documentId,ack.sequence);setDetail(next);minimumSequence.current=next.article.sequence;setBlocked(false);setConfirmedUnread(false);setCoverFailed(false);}catch(e){setError(publicationError(e,true));}
  }catch(e){const unknown=uncertain||!(e instanceof PublicationRejected);setUncertain(unknown);if(!unknown){pending.current=null;setBlocked(true);}setError(publicationError(unknown?new Error('UNKNOWN_RESULT'):e));}finally{operation.current=false;setBusy('');}
 }
 const reader=parseReaderBody(article.body);const state=statuses.find(s=>s.id===article.status)?.name??article.status;
 return <section className="review-decision publication-panel" aria-label="文章发布管理">
  <nav className="review-decision-links" aria-label="发布导航">{!locked&&<><a href={`/admin/review?article=${encodeURIComponent(article.documentId)}`}>返回二审详情</a><a href={`/admin/editor?article=${encodeURIComponent(article.documentId)}`}>编辑文章</a><a href="/admin">返回内容工作台</a><a href={`/admin/availability?article=${encodeURIComponent(article.documentId)}`}>归档与下线</a><a href={`/admin/history?article=${encodeURIComponent(article.documentId)}`}>历史记录与版本</a></>}<button type="button" disabled={locked} onClick={()=>void reload()}>{busy==='read'?'正在读取…':'重新读取发布状态'}</button></nav>
  {notice&&<p role="status">{notice}</p>}{confirmedUnread&&<p className="review-control-warning">操作已经确认。本页文章状态和记录仍是上次读取结果，请重新读取以核对最新资料。</p>}
  <header><p className="review-decision-eyebrow">工作修订 {revision} · {state}</p><h2>{article.title}</h2><dl className="review-decision-metadata"><div><dt>资料类型</dt><dd>{kinds[article.kind]}</dd></div><div><dt>发布后阅读范围</dt><dd>{{staff:'普通员工',ops:'Ops 与 Admin',admin:'仅 Admin'}[article.audience]}</dd></div><div><dt>批准管理员</dt><dd>{approval?.reviewerName??'当前版本无有效批准记录'}</dd></div><div><dt>批准时间</dt><dd>{approval?<time dateTime={approval.approvedAt}>{time(approval.approvedAt)}（马来西亚时间）</time>:'尚无记录'}</dd></div>{article.kind==='qa'&&<><div><dt>问答分类</dt><dd>{article.qa?.category||'未分类'}</dd></div><div><dt>问答排序</dt><dd>{article.qa?.position??0}</dd></div></>}</dl><p>当前正式版：{article.publishedRevision===null?'尚未发布':`已发布（工作修订 ${article.publishedRevision}）`}</p><p>加入等待发布后不会自动上线。正式发布成功前，已有正式版继续可读。</p></header>
  <section className="review-decision-controls" aria-label="发布操作">
   {!canQueue&&!canPublish&&<p>{article.lifecycle!=='active'?'文章已停用，不能安排或执行发布。':article.status==='published'?'当前版本已经发布。':!approval?'当前版本没有可用于发布的二审批准，请先完成审核。':'当前状态不能安排或执行发布，请重新核对。'}</p>}
   {(canQueue||canPublish)&&(!confirm?<div className="review-decision-actions">{canQueue&&<button type="button" disabled={locked||blocked} onClick={()=>setConfirm('queue')}>加入等待发布</button>}{canPublish&&<button type="button" disabled={locked||blocked} onClick={()=>setConfirm('publish')}>正式发布此版本</button>}</div>:<div className="review-decision-confirm"><h3>{confirm==='queue'?'确认安排此版本':'确认正式发布此版本'}</h3><p>本次操作针对已批准的版本 {revision}，由 {approval!.reviewerName} 完成二审。</p>{confirm==='queue'?<p>确认后进入等待发布；员工暂时看不到这次更新。</p>:<><p>{article.publishedRevision===null?`发布后，工作修订 ${revision} 将成为首个正式版。`:`发布后，工作修订 ${revision} 将替换正式内容（工作修订 ${article.publishedRevision}）。`}</p><p>具备当前阅读权限的员工将看到本次正文、分类和附件；旧链接也按新正式版的权限检查。</p></>}<div className="review-decision-actions"><button type="button" disabled={Boolean(busy)||blocked&&!uncertain} onClick={()=>void change()}>{busy==='write'?'正在提交…':uncertain?'重试原操作':confirm==='queue'?'确认加入等待发布':'确认正式发布'}</button><button type="button" disabled={locked} onClick={()=>{setConfirm(null);setError('');}}>取消操作</button></div></div>)}
   {error&&<p role="alert">{error}</p>}
  </section>
  <ArticleCategories options={article.categoryOptions} ids={article.categoryIds}/><FieldValues fields={article.customFields}/><section className="publication-preview" aria-label="发布内容核对"><h3>当前保存的内容</h3><p>标签：{article.tags.length?article.tags.join('、'):'无标签'}</p>{article.cover&&<figure className="review-decision-cover">{coverFailed?<p>封面暂时无法读取，请核对原文件。</p>:<img src={`/api/admin/assets/${encodeURIComponent(article.cover.assetId)}`} alt={article.cover.alt} style={{objectPosition:`50% ${article.cover.position}%`}} onError={()=>setCoverFailed(true)}/>}<figcaption>文章封面 · {article.cover.alt||'未填写替代文字'}</figcaption></figure>}<article className="review-decision-body" aria-label="当前保存正文"><DocumentView document={reader} documentId={article.documentId} admin/>{!reader.editorBlocks&&article.blocks.length>0&&<MediaBlocks blocks={article.blocks} documentId={article.documentId} admin/>}</article></section>
  <section className="review-control-history" aria-label="发布记录"><h3>发布记录</h3><p>已载入 {detail.history.length} 条安排或发布记录，最多显示最近 20 条。{detail.historyMore?'另有更早记录，本页未载入。':''}</p>{detail.history.length?<ol>{detail.history.map(h=><li key={h.sequence}><p><strong>{h.action==='queue'?'加入等待发布':'正式发布'}</strong> · 版本 {h.revision}</p><p>操作人：{h.actorName}</p><time dateTime={h.at}>{time(h.at)}（马来西亚时间）</time></li>)}</ol>:<p>暂未记录安排或发布操作。</p>}</section>
 </section>;
}
