'use client';
import {useState} from 'react';
import Form from 'next/form';
import {useRouter} from 'next/navigation';
import {kinds,scopes,statuses,workspaceHref,type WorkspaceQuery} from '../../workspace/model';
import {ArcScope} from '../ui/arc/ArcScope';
import {FilterToolbar,type FilterChip} from '../ui/arc/filter-toolbar/filter-toolbar';
/** Official UIArc controls apply the existing server query; no client-only filtering. */
export function TasksFilterBar(props:{query:WorkspaceQuery;action?:string}){
 return <FilterForm key={JSON.stringify(props.query)} {...props}/>;
}
function FilterForm({query,action='/admin'}:{query:WorkspaceQuery;action?:string}){
 const router=useRouter();
 const [search,setSearch]=useState(query.q);
 function navigate(patch:Partial<WorkspaceQuery>){
  const href=workspaceHref(query,{q:search,...patch,page:1});
  router.push(action+href.slice(href.indexOf('?')));
 }
 const filters:FilterChip[]=[];
 if(query.q)filters.push({id:'q',label:query.kind==='qa'?'问题':'标题',value:query.q});
 if(query.status!=='all')filters.push({id:'status',label:'内容状态',value:statuses.find(status=>status.id===query.status)!.name});
 if(query.scope!=='all')filters.push({id:'scope',label:'内容范围',value:scopes[query.scope]});
 return <div className="workspace-filter-bar">
  <Form className="tasks-filters" action={action}>
   <input type="hidden" name="scope" value={query.scope}/><input type="hidden" name="view" value={query.view}/><input type="hidden" name="status" value={query.status}/><input type="hidden" name="page" value="1"/>
   <label className="task-search">{query.kind==='qa'?'搜索问题':'搜索标题'}<input type="search" name="q" value={search} onChange={event=>setSearch(event.target.value)} placeholder={query.kind==='qa'?'输入问题':'输入文章标题'} maxLength={120}/></label>
   <label>资料类型<select name="kind" defaultValue={query.kind} onChange={event=>navigate({kind:event.target.value as WorkspaceQuery['kind']})}><option value="all">全部类型</option>{Object.entries(kinds).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
   <button className="task-apply" type="submit">应用筛选</button>
  </Form>
  <noscript><a className="task-reset" href={workspaceHref(query,{q:'',scope:'all',status:'all',page:1}).replace('/admin?',action+'?')}>清除筛选</a></noscript>
  <ArcScope><FilterToolbar filters={filters} onRemove={id=>navigate(id==='q'?{q:''}:id==='status'?{status:'all'}:{scope:'all'})} onClearAll={()=>navigate({q:'',scope:'all',status:'all'})} label="已应用的筛选"
   addFilter={{label:'添加筛选',fields:[{id:'status',label:'内容状态',options:[{value:'all',label:'全部状态'},...statuses.map(status=>({value:status.id,label:status.name}))]}],onAdd:filter=>navigate({status:statuses.find(status=>status.name===filter.value)?.id??'all'})}}/></ArcScope>
 </div>;
}
