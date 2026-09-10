import {TaskCard} from './TaskCard';
import type {WorkspaceItem} from '../../workspace/model';
import type {Status} from '../../domain/model';
// Adapted from Square UI Tasks task-column.tsx: status pill, count and stacked cards.
export function TaskColumn({status,items,total}:{status:{id:Status;name:string};items:WorkspaceItem[];total:number}){
 return <section className="task-column" aria-label={status.name}><header><h2 className={`task-state state-${status.id}`}>{status.name}</h2><span>{total}</span></header><p className="task-column-note">本页 {items.length} / 共 {total} 篇</p>
 {items.length?items.map(task=><TaskCard key={task.id} task={task}/>):<p className="task-column-empty">{total?'本页无此状态内容，请按状态筛选或翻页。':'此状态暂无内容'}</p>}</section>;
}
