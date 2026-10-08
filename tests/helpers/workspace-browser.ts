import {arcBrowserBundle} from './arc-browser';
let bundle:ReturnType<typeof arcBrowserBundle>|undefined;
function workspaceBundle(){
 return bundle??=arcBrowserBundle('workspace',`import React from 'react';import {createRoot} from 'react-dom/client';import {TasksWorkspace} from '../../../src/components/tasks/TasksWorkspace';const data=JSON.parse(document.getElementById('data').textContent);createRoot(document.getElementById('workspace')).render(React.createElement(TasksWorkspace,{data:data??undefined}));`);
}
import {statuses,workspaceQuery,type WorkspaceItem,type WorkspaceData} from '../../src/workspace/model';
export const workspaceRows:WorkspaceItem[]=Array.from({length:36},(_,i)=>({id:`local-${i}`,title:i===0?'中文标题 <script> 不执行':`资料核对 ${i}`,kind:i%3===0?'ops':'article',status:statuses[i%6].id,sequence:2,revision:2,publishedRevision:i===0?1:i%6===5?2:null,updatedAt:'2026-09-09T03:00:00.000Z',author:'管理员 A',editor:'管理员 A',submitter:i%6===0?null:'管理员 A',reviewer:i%6===0?null:'管理员 B'}));
export async function workspaceHTML(url:string,{empty=false,failed=false}:{empty?:boolean;failed?:boolean}={}){
 const u=new URL(url),input=Object.fromEntries(u.searchParams);const query=workspaceQuery(input);
 // Isolated UI data only. Real query semantics/authorization are exercised against PostgreSQL separately.
 let items=empty?[]:workspaceRows.filter(r=>r.title.includes(query.q)&&(query.kind==='all'||r.kind===query.kind));
 if(query.scope==='review')items=[];else if(query.scope==='returned')items=items.filter(r=>r.status==='changes_requested');else if(query.scope==='submitted')items=items.filter(r=>r.submitter==='管理员 A');
 const counts=Object.fromEntries(statuses.map(s=>[s.id,items.filter(r=>r.status===s.id).length])) as WorkspaceData['counts'];
 if(query.status!=='all')items=items.filter(r=>r.status===query.status);
 const total=items.length,pages=Math.max(1,Math.ceil(total/30)),page=Math.min(pages,query.page);
 const data:WorkspaceData={query:{...query,page},items:items.slice((page-1)*30,page*30),counts,total,pages,page};
 const built=await workspaceBundle();
 const json=JSON.stringify(failed?null:data).replaceAll('<','\\u003c');
 return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${built.css}</style></head><body><header class="site-header"><strong>JUYU · 本地样例</strong></header><div id="workspace"></div><script id="data" type="application/json">${json}</script><script>${built.script.replaceAll('</script','<\\/script')}</script></body></html>`;
}
