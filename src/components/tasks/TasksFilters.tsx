import Form from 'next/form';
import {kinds,statuses,workspaceHref,type WorkspaceQuery} from '../../workspace/model';
// Adapted from Square UI Tasks tasks-filters.tsx: responsive search/control row; native GET is progressive enhancement.
export function TasksFilters({query}:{query:WorkspaceQuery}){
 return <Form key={JSON.stringify(query)} className="tasks-filters" action="/admin"><input type="hidden" name="view" value={query.view}/>
 <label className="task-search">{query.kind==='qa'?'搜索问题':'搜索标题'}<input type="search" name="q" defaultValue={query.q} placeholder={query.kind==='qa'?'输入问题':'输入文章标题'} maxLength={120}/></label>
 <input type="hidden" name="scope" value={query.scope}/>
 <label>资料类型<select name="kind" defaultValue={query.kind}><option value="all">全部类型</option>{Object.entries(kinds).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
 <label>内容状态<select name="status" defaultValue={query.status}><option value="all">全部状态</option>{statuses.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
 <button className="task-apply" type="submit">应用筛选</button><a className="task-reset" href={workspaceHref(query,{q:'',scope:'all',status:'all',page:1})}>清除筛选</a>
 </Form>;
}
