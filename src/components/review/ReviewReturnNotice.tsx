import type {ReturnFeedback} from '../../editor/contract';

/** Review text is plain text, never editor content or HTML. */
export function ReviewReturnNotice({feedback,status,documentId,locale='zh-CN'}:{feedback:ReturnFeedback|null|undefined;status:string;documentId:string;locale?:'zh-CN'|'en'}){
 if(!feedback||!['draft','changes_requested'].includes(status))return null;
 const english=locale==='en';
 return <section className="editor-return-notice" aria-label={english?'Requested changes':'退回修改意见'}>
  <h2>{english?'Requested changes':'退回修改意见'}</h2>
  <p className="editor-return-meta">{english?`Reviewer: ${feedback.reviewerName} · Working revision ${feedback.revision}`:`审核人：${feedback.reviewerName} · 对应工作修订 ${feedback.revision}`} · <time dateTime={feedback.decidedAt}>{new Intl.DateTimeFormat(english?'en':'zh-CN',{timeZone:'Asia/Kuala_Lumpur',dateStyle:'short',timeStyle:'short'}).format(new Date(feedback.decidedAt))}</time></p>
  <p className="editor-return-reason">{feedback.reason}</p>
  <p>{status==='draft'?(english?'This is feedback from the previous review. Keep it for reference while revising.':'这是上一轮审核的意见，修改保存后仍保留，方便你继续核对。'):(english?'Make the requested changes, save, then submit for review again.':'请按以上原因修改并保存，再重新提交二审。')}</p>
  <a href={`/admin/review?article=${encodeURIComponent(documentId)}`}>{english?'View review details':'查看审核详情'}</a>
 </section>;
}
