import type {FeedbackDetails,FeedbackOverview} from '../feedback/model';
export function FeedbackDashboard({overview,details}:{overview?:FeedbackOverview;details?:FeedbackDetails}){
 if(details){const {summary:s}=details;return <>
  <a className="back-link" href="/admin/feedback">← 全部文章反馈</a><h2>{s.title}</h2><p className="access-description">正式版本 {s.revision} · {s.current?'当前已发布版本':'历史版本或已下线'} · 共 {s.total} 份反馈</p>
  <div className="feedback-counts"><span>有帮助 <strong>{s.helpful}</strong></span><span>没有帮助 <strong>{s.unhelpful}</strong></span></div>
  <ul className="feedback-entries" aria-label="反馈明细">{details.entries.map(e=><li key={e.memberId}><div><strong>{e.memberName}</strong><span>{e.helpful?'有帮助':'没有帮助'}</span></div><p className="feedback-message">{e.comment??'未填写补充说明'}</p><time dateTime={e.updatedAt}>{new Date(e.updatedAt).toLocaleString('zh-CN',{timeZone:'Asia/Kuala_Lumpur',hour12:false})}（马来西亚时间）</time></li>)}</ul>
  <Pagination page={details.page} pages={details.pages} prefix={`?document=${encodeURIComponent(s.documentId)}&revision=${s.revision}&`}/>
 </>;}
 if(!overview)return null;
 if(!overview.total)return <div className="feedback-empty"><h2>暂时没有反馈</h2><p>员工提交后，这里会按文章版本显示真实数量和说明。</p></div>;
 return <><p className="access-description">共 {overview.total} 个文章版本收到反馈；同一员工对同一版本只计一份。</p>
  <ul className="feedback-overview" aria-label="文章反馈汇总">{overview.items.map(s=><li key={`${s.documentId}:${s.revision}`}><div><h2><a href={`/admin/feedback?document=${encodeURIComponent(s.documentId)}&revision=${s.revision}`}>{s.title}</a></h2><p>正式版本 {s.revision} · {s.current?'当前已发布版本':'历史版本或已下线'}</p></div><div className="feedback-counts"><span>有帮助 <strong>{s.helpful}</strong></span><span>没有帮助 <strong>{s.unhelpful}</strong></span></div><a className="secondary-link" href={`/admin/feedback?document=${encodeURIComponent(s.documentId)}&revision=${s.revision}`}>查看 {s.total} 份反馈 →</a></li>)}</ul>
  <Pagination page={overview.page} pages={overview.pages} prefix="?"/></>;
}
function Pagination({page,pages,prefix}:{page:number;pages:number;prefix:string}){if(pages<2)return null;return <nav className="search-pagination" aria-label="反馈分页">{page>1&&<a className="secondary-link" href={`/admin/feedback${prefix}page=${page-1}`}>上一页</a>}<span>第 {page} / {pages} 页</span>{page<pages&&<a className="secondary-link" href={`/admin/feedback${prefix}page=${page+1}`}>下一页</a>}</nav>;}
