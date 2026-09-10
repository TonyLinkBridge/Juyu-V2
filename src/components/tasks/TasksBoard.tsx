import {statuses,type WorkspaceData} from '../../workspace/model';
import {TaskColumn} from './TaskColumn';
// Adapted from Square UI Tasks tasks-board.tsx; server-supplied page replaces Zustand/demo store.
export function TasksBoard({data}:{data:WorkspaceData}){
 return <div className="tasks-board" role="region" aria-label="六状态内容看板" tabIndex={0}>{statuses.filter(s=>data.query.status==='all'||data.query.status===s.id).map(status=><TaskColumn key={status.id} status={status} items={data.items.filter(t=>t.status===status.id)} total={data.counts[status.id]}/>)}</div>;
}
