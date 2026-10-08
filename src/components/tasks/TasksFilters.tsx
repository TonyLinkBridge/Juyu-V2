import {TasksFilterBar} from './TasksFilterBar';
import type {WorkspaceQuery} from '../../workspace/model';
export function TasksFilters({query}:{query:WorkspaceQuery}){
 return <TasksFilterBar query={query}/>;
}
