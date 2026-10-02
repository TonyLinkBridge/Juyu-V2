import type {WorkspaceItem} from '../../workspace/model';
/** Both list and board describe the current working revision. */
export function TaskCategories({task}:{task:WorkspaceItem}){
 if(task.kind==='qa')return <small className="task-category-summary">分类：{task.qaCategory||'未分类'} · 排序：{task.qaPosition??0}（数字越小越靠前）</small>;
 const paths=task.categoryPaths??[];
 if(paths.length<=2)return <small className="task-category-summary">分类：{paths.length?paths.join('、'):'未分类'}</small>;
 return <details className="task-category-details"><summary>分类：{paths.slice(0,2).join('、')} · 另 {paths.length-2} 项</summary><ul>{paths.slice(2).map((path,index)=><li key={index}>{path}</li>)}</ul></details>;
}
