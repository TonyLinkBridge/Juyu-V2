import {statuses,type WorkspaceData} from '../../workspace/model';
import {TaskCard} from './TaskCard';
// JUYU addition: the same server page in a responsive list, including the current workflow state.
export function TasksList({data}:{data:WorkspaceData}){
 return <ol className="tasks-list" aria-label="内容列表">{data.items.map(task=><li key={task.id}><span className={`task-state state-${task.status}`}>{statuses.find(s=>s.id===task.status)!.name}</span><TaskCard task={task}/></li>)}</ol>;
}
