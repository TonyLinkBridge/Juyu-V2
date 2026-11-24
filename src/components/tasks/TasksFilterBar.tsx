'use client';
import {useEffect,useRef,useState,useSyncExternalStore,useTransition} from 'react';
import Form from 'next/form';
import {useRouter} from 'next/navigation';
import {kinds,scopes,statuses,workspaceHref,type WorkspaceQuery} from '../../workspace/model';
import {ArcScope} from '../ui/arc/ArcScope';
import {Select} from '../ui/arc/select/select';
import {FilterMenu,FilterToolbar,type FilterChip} from '../ui/arc/filter-toolbar/filter-toolbar';
const subscribe=()=>()=>{};
const enhancedSnapshot=()=>true;
const serverSnapshot=()=>false;
/** Official UIArc controls apply the existing server query; no client-only filtering. */
export function TasksFilterBar(props:{query:WorkspaceQuery;action?:string}){
 return <FilterForm key={JSON.stringify(props.query)} {...props}/>;
}
function FilterForm({query,action='/admin'}:{query:WorkspaceQuery;action?:string}){
 const router=useRouter();
 const [search,setSearch]=useState(query.q);
 const enhanced=useSyncExternalStore(subscribe,enhancedSnapshot,serverSnapshot);
 const [pending,startTransition]=useTransition();
 const navigating=useRef(false);
 useEffect(()=>{if(!pending)navigating.current=false;},[pending]);
 function navigate(patch:Partial<WorkspaceQuery>){
  if(navigating.current)return;
  const href=workspaceHref(query,{q:search,...patch,page:1});
  if(href===workspaceHref(query))return;
  navigating.current=true;
  startTransition(()=>router.push(action+href.slice(href.indexOf('?'))));
 }
 const filters:FilterChip[]=[];
 if(query.q)filters.push({id:'q',label:query.kind==='qa'?'问题':'标题',value:query.q});
 if(query.status!=='all')filters.push({id:'status',label:'内容状态',value:statuses.find(status=>status.id===query.status)!.name});
 if(query.scope!=='all')filters.push({id:'scope',label:'内容范围',value:scopes[query.scope]});
 return <div className="workspace-filter-bar">
  <fieldset className="workspace-filter-fields" disabled={pending} aria-busy={pending}>
  <div className="workspace-filter-controls"><Form className="tasks-filters" action={action} onSubmit={event=>{event.preventDefault();navigate({});}}>
   <input type="hidden" name="scope" value={query.scope}/><input type="hidden" name="view" value={query.view}/><input type="hidden" name="status" value={query.status}/><input type="hidden" name="page" value="1"/>
   <label className="task-search">{query.kind==='qa'?'搜索问题':'搜索标题'}<input type="search" name="q" value={search} onChange={event=>setSearch(event.target.value)} placeholder={query.kind==='qa'?'输入问题':'输入文章标题'} maxLength={120}/></label>
   {enhanced?<ArcScope className="workspace-kind-select"><Select label="资料类型" name="kind" value={query.kind} disabled={pending} onValueChange={value=>navigate({kind:value as WorkspaceQuery['kind']})} options={[{value:'all',label:'全部类型'},...Object.entries(kinds).map(([value,label])=>({value,label}))]}/></ArcScope>:<label>资料类型<select name="kind" defaultValue={query.kind}><option value="all">全部类型</option>{Object.entries(kinds).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>}
   <button className="task-apply" type="submit">{pending?'正在筛选…':'应用筛选'}</button>
  </Form><ArcScope><FilterMenu presentation="compact" disabled={pending} label="添加筛选" fields={[{id:'status',label:'内容状态',options:[{value:'all',label:'全部状态'},...statuses.map(status=>({value:status.id,label:status.name}))]}]} active={query.status==='all'?[...filters,{id:'status',label:'内容状态',value:'全部状态'}]:filters} onSelect={filter=>navigate({status:statuses.find(status=>status.name===filter.value)?.id??'all'})}/></ArcScope></div>
  <noscript><a className="task-reset" href={workspaceHref(query,{q:'',scope:'all',status:'all',page:1}).replace('/admin?',action+'?')}>清除筛选</a></noscript>
  {filters.length>0&&<ArcScope><FilterToolbar filters={filters} onRemove={id=>navigate(id==='q'?{q:''}:id==='status'?{status:'all'}:{scope:'all'})} onClearAll={()=>navigate({q:'',scope:'all',status:'all'})} label="已应用的筛选"/></ArcScope>}
  </fieldset>
  <p className="workspace-filter-feedback" role="status">{pending?'正在筛选，请稍候…':''}</p>
 </div>;
}
