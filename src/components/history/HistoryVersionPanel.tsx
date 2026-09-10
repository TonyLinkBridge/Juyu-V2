'use client';
import {FieldValues} from '../fields/FieldValues';
/* eslint-disable @next/next/no-img-element -- historical private cover bytes use the selected-version route with the current session. */
import {useEffect,useRef,useState} from 'react';
import type {HistoryVersion,RestoreVersionInput} from '../../history/model';
import {HistoryRestoreRejected,historyRestoreError,readHistoryVersion,restoreHistoryVersion} from '../../history/client';
import {parseReaderBody} from '../../reader/body';
import {DocumentView} from '../gitbook/Reading/DocumentView';
import {MediaBlocks} from '../gitbook/Media/MediaBlocks';
const statusLabels={draft:'草稿',in_review:'审核中',changes_requested:'待修改',approved:'已批准',queued:'待发布',published:'已发布'};
function HistoryCover({url,alt,position}:{url:string;alt:string;position:number}){
 const [failed,setFailed]=useState(false);
 return <figure className="review-decision-cover">{failed?<p>历史封面暂时无法读取。</p>:<img src={url} alt={alt||'历史版本封面'} style={{objectPosition:`center ${position}%`}} onError={()=>setFailed(true)}/>}<figcaption><a href={url} target="_blank" rel="noopener noreferrer">打开历史封面</a></figcaption></figure>;
}
export function HistoryVersionPanel({initial}:{initial:HistoryVersion}){
 const [detail,setDetail]=useState(initial),[confirming,setConfirming]=useState(false),[busy,setBusy]=useState<'read'|'write'|''>(''),[uncertain,setUncertain]=useState(false),[blocked,setBlocked]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[confirmedUnread,setConfirmedUnread]=useState(false);
 const operation=useRef(false),pending=useRef<{input:RestoreVersionInput;currentRevision:number;publishedRevision:number|null}|null>(null),minimumSequence=useRef(initial.sequence),minimumRevision=useRef(initial.currentRevision);
 useEffect(()=>{
  // Guard the actual outer navigation too, including the synchronous request start.
  const held=()=>operation.current||pending.current!==null;
  const warn=(event:BeforeUnloadEvent)=>{if(held()){event.preventDefault();event.returnValue='';}};
  const link=(event:MouseEvent)=>{if(held()&&event.target instanceof Element&&event.target.closest('a[href]')){event.preventDefault();event.stopPropagation();}};
  window.addEventListener('beforeunload',warn);document.addEventListener('click',link,true);document.addEventListener('auxclick',link,true);
  return()=>{window.removeEventListener('beforeunload',warn);document.removeEventListener('click',link,true);document.removeEventListener('auxclick',link,true);};
 },[]);
 const version=detail.version,id=encodeURIComponent(detail.documentId),locked=Boolean(busy)||uncertain;
 const allowed=detail.canRestore&&detail.lifecycle==='active'&&detail.status!=='in_review'&&version.revision<detail.currentRevision;
 const base=`/api/admin/history/${id}/versions/${version.revision}/assets/`;
 async function reload(){
  if(operation.current||pending.current)return;operation.current=true;setBusy('read');setBlocked(true);setError('');
  try{const next=await readHistoryVersion(detail.documentId,version.revision,minimumSequence.current,minimumRevision.current);setDetail(next);minimumSequence.current=next.sequence;minimumRevision.current=next.currentRevision;setConfirming(false);setBlocked(false);setConfirmedUnread(false);}catch(e){setError(historyRestoreError(e,true));}finally{operation.current=false;setBusy('');}
 }
 async function restore(){
  if(operation.current||!uncertain&&(blocked||!confirming||!allowed))return;
  const exact=pending.current??{input:{expectedSequence:detail.sequence,sourceRevision:version.revision},currentRevision:detail.currentRevision,publishedRevision:detail.publishedRevision};pending.current=exact;operation.current=true;setBusy('write');setError('');setNotice('');
  try{
   const ack=await restoreHistoryVersion(detail.documentId,exact.input,exact.currentRevision,exact.publishedRevision);minimumSequence.current=ack.sequence;minimumRevision.current=ack.revision;pending.current=null;setUncertain(false);setConfirming(false);setBlocked(true);setConfirmedUnread(true);setNotice(`已从版本 ${ack.sourceRevision} 建立新草稿版本 ${ack.revision}。${ack.publishedRevision===null?'当前仍无正式版。':`正式版 ${ack.publishedRevision} 保持不变。`}新草稿必须重新二审和发布。`);setBusy('read');
   try{const next=await readHistoryVersion(detail.documentId,version.revision,ack.sequence,ack.revision);setDetail(next);minimumSequence.current=next.sequence;minimumRevision.current=next.currentRevision;setBlocked(false);setConfirmedUnread(false);}catch(e){setError(historyRestoreError(e,true));}
  }catch(e){const unknown=uncertain||!(e instanceof HistoryRestoreRejected);setUncertain(unknown);if(!unknown){pending.current=null;setBlocked(true);}setError(historyRestoreError(unknown?new Error('UNKNOWN_RESULT'):e));}finally{operation.current=false;setBusy('');}
 }
 let body:ReturnType<typeof parseReaderBody>|null=null;
 try{body=parseReaderBody(version.body);}catch{body=null;}
 const reason=detail.lifecycle==='archived'?'请先从归档恢复资料，再恢复历史版本。':detail.lifecycle==='trashed'?'请先从回收站恢复资料，再恢复历史版本。':detail.status==='in_review'?'请先结束当前审核，再恢复历史版本。':version.revision>=detail.currentRevision?'当前工作版本不能作为历史恢复来源。':'当前账号、资料状态或来源文件不允许恢复，请重新读取后核对。';
 return <section className="review-decision" aria-label="历史版本详情">
  <nav className="review-decision-links" aria-label="历史版本导航">{!locked&&<><a href={`/admin/history?article=${id}`}>返回完整历史记录</a><a href="/admin">返回内容工作台</a>{detail.lifecycle==='active'&&<a href={`/admin/editor?article=${id}`}>编辑当前文章</a>}{detail.lifecycle==='archived'&&<a href={`/admin/availability?article=${id}`}>管理归档资料</a>}{detail.lifecycle==='trashed'&&<a href="/admin/trash">查看回收站</a>}</>}<button type="button" disabled={locked} onClick={()=>void reload()}>{busy==='read'?'正在读取…':'重新读取版本状态'}</button></nav>
  {notice&&<p role="status">{notice}</p>}{confirmedUnread&&<p className="review-control-warning">恢复已经确认。下方工作状态仍是上次读取结果，请重新读取后核对。</p>}
  <header><p className="review-decision-eyebrow">历史版本 {version.revision} · 只读预览</p><h2>{version.title}</h2><p>当前工作版本：{detail.currentRevision}</p><p>当前状态：{statusLabels[detail.status]} · {{active:'工作台资料',archived:'已归档',trashed:'回收站资料'}[detail.lifecycle]}</p><p>当前正式版：{detail.publishedRevision===null?'无':`版本 ${detail.publishedRevision}`}</p></header>
  <section className="review-decision-controls" aria-label="恢复历史版本">{!allowed&&<p>{reason}</p>}{!confirming?allowed&&<button type="button" disabled={locked||blocked} onClick={()=>setConfirming(true)}>恢复此版本为新草稿</button>:<div className="review-decision-confirm"><h3>从历史版本 {version.revision} 建立新草稿？</h3><p>将复制此版本的正文、可见范围、标签、封面、内容块、分类和全部版本附件；原作者保留，当前操作人成为新版本编辑。</p><p>当前工作版本 {detail.currentRevision} 仍保留在历史中，不会被覆盖。</p><p>{detail.publishedRevision===null?'当前没有正式版，恢复后仍不会自动发布。':`当前正式版 ${detail.publishedRevision} 保持不变。`}</p><p>新草稿必须重新提交独立二审，再由管理员发布。</p><div className="review-decision-actions"><button type="button" disabled={Boolean(busy)||blocked&&!uncertain} onClick={()=>void restore()}>{busy==='write'?'正在恢复…':uncertain?'重试原操作':'确认恢复为新草稿'}</button><button type="button" disabled={locked} onClick={()=>{setConfirming(false);setError('');}}>取消恢复</button></div></div>}{error&&<p role="alert">{error}</p>}</section>
  <dl className="review-decision-metadata"><div><dt>来源版本作者</dt><dd title={version.authorId}>{version.authorName||version.authorId}</dd></div><div><dt>来源版本编辑</dt><dd title={version.editorId}>{version.editorName||version.editorId}</dd></div><div><dt>版本保存时间（马来西亚时间）</dt><dd><time dateTime={version.createdAt}>{new Date(version.createdAt).toLocaleString('zh-CN',{timeZone:'Asia/Kuala_Lumpur',hour12:false})}</time></dd></div><div><dt>来源版本可见范围</dt><dd>{{staff:'全体员工',ops:'运营与管理员',admin:'仅管理员'}[version.audience]}</dd></div><div><dt>来源版本分类</dt><dd>{detail.categories.length?detail.categories.map(c=><span key={c.id} style={{display:'block'}}>{c.name}</span>):'未分类'}</dd></div><div><dt>来源版本标签</dt><dd>{version.tags.length?version.tags.map(tag=><span key={tag} style={{display:'block'}}>{tag}</span>):'无标签'}</dd></div>{version.qa&&<><div><dt>来源问答分类</dt><dd>{version.qa.category||'未分类'}</dd></div><div><dt>来源问答排序</dt><dd>{version.qa.position}</dd></div></>}</dl>
  {version.cover&&<HistoryCover key={`${base}${version.cover.assetId}`} url={`${base}${encodeURIComponent(version.cover.assetId)}`} alt={version.cover.alt} position={version.cover.position}/>}
  <FieldValues fields={version.customFields}/><section className="review-decision-body" aria-label="历史版本正文">{body?<><DocumentView document={body} documentId={detail.documentId} revision={version.revision} admin/>{!body.editorBlocks&&version.blocks.length>0&&<MediaBlocks blocks={version.blocks} documentId={detail.documentId} revision={version.revision} admin/>}</>:<p role="alert">历史正文格式无法读取，不能确认完整预览。</p>}</section>
  <section className="review-control-history" aria-label="来源版本全部附件"><h3>来源版本全部附件</h3><p>本版本关联 {detail.assets.length} 个文件，包括正文未单独显示的附件。</p>{detail.assets.length?<ol>{detail.assets.map(asset=><li key={asset.id}><p><strong>{asset.filename}</strong> · {asset.mime} · {asset.size} 字节</p>{asset.status==='ready'?<nav className="review-decision-links"><a href={`${base}${encodeURIComponent(asset.id)}`} target="_blank" rel="noopener noreferrer">打开 {asset.filename}</a><a href={`${base}${encodeURIComponent(asset.id)}?download=1`} download>下载 {asset.filename}</a></nav>:<p>此来源文件当前无法读取（{asset.status}）。</p>}</li>)}</ol>:<p>此版本没有关联附件。</p>}</section>
 </section>;
}
