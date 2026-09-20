import {kinds,publicationLabel,type WorkspaceItem} from '../../workspace/model';
// Adapted from Square UI Tasks task-card.tsx: rounded card, metadata and separated footer.
export function TaskCard({task}:{task:WorkspaceItem}){
 return <article className="task-card">
  <div className="task-card-top"><span className="task-kind">{kinds[task.kind]}</span><span>工作修订 {task.revision}</span></div>
  <h3><a href={`/admin/editor?article=${encodeURIComponent(task.id)}`}>{task.title}</a></h3>
  <p className="task-publication">{publicationLabel(task)}</p>
  {task.kind==='qa'&&<p>分类：{task.qaCategory||'未分类'} · 排序：{task.qaPosition??0}（数字越小越靠前）</p>}
  <dl><div><dt>编辑人</dt><dd>{task.editor}</dd></div><div><dt>提交人</dt><dd>{task.submitter??'尚未提交'}</dd></div><div><dt>二审人</dt><dd>{task.reviewer??'尚未指定'}</dd></div></dl>
  <footer><time dateTime={task.updatedAt}>{new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Kuala_Lumpur',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(task.updatedAt))}</time><span>更新 · 马来西亚时间</span></footer>
 </article>;
}
