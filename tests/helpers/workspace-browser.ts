import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
let component:typeof import('../../src/components/tasks/TasksWorkspace').TasksWorkspace;
async function workspaceComponent(){
 if(component)return component;
 const directory=resolve('output/verification/workspace-fixture');await mkdir(directory,{recursive:true});await writeFile(resolve(directory,'package.json'),'{"type":"commonjs"}');
 for(const name of ['src/workspace/model.ts',...['TaskCard','TaskColumn','TasksBoard','TasksFilters','TasksList','TasksWorkspace'].map(n=>`src/components/tasks/${n}.tsx`)]){
  const destination=resolve(directory,name.replace(/\.tsx?$/,'.js'));await mkdir(dirname(destination),{recursive:true});
  const compiled=ts.transpileModule(await readFile(name,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText.replace(/require\("([^"\n]+)\.ts"\)/g,'require("$1.js")');
  await writeFile(destination,compiled);
 }
 component=require(resolve(directory,'src/components/tasks/TasksWorkspace.js')).TasksWorkspace;return component;
}
import {statuses,workspaceQuery,type WorkspaceItem,type WorkspaceData} from '../../src/workspace/model';
export const workspaceRows:WorkspaceItem[]=Array.from({length:36},(_,i)=>({id:`local-${i}`,title:i===0?'中文标题 <script> 不执行':`资料核对 ${i}`,kind:i%3===0?'ops':'article',status:statuses[i%6].id,revision:2,publishedRevision:i%6===0?1:i%6===5?2:null,updatedAt:'2026-09-09T03:00:00.000Z',author:'管理员 A',editor:'管理员 A',submitter:i%6===0?null:'管理员 A',reviewer:i%6===0?null:'管理员 B'}));
export async function workspaceHTML(url:string,{empty=false,failed=false}:{empty?:boolean;failed?:boolean}={}){
 const u=new URL(url),input=Object.fromEntries(u.searchParams);const query=workspaceQuery(input);
 // Isolated UI data only. Real query semantics/authorization are exercised against PostgreSQL separately.
 let items=empty?[]:workspaceRows.filter(r=>r.title.includes(query.q)&&(query.kind==='all'||r.kind===query.kind));
 if(query.scope==='review')items=[];else if(query.scope==='returned')items=items.filter(r=>r.status==='changes_requested');else if(query.scope==='submitted')items=items.filter(r=>r.submitter==='管理员 A');
 const counts=Object.fromEntries(statuses.map(s=>[s.id,items.filter(r=>r.status===s.id).length])) as WorkspaceData['counts'];
 if(query.status!=='all')items=items.filter(r=>r.status===query.status);
 const total=items.length,pages=Math.max(1,Math.ceil(total/30)),page=Math.min(pages,query.page);
 const data:WorkspaceData={query:{...query,page},items:items.slice((page-1)*30,page*30),counts,total,pages,page};
 const directory=resolve('.next/static/chunks');const css=(await Promise.all((await readdir(directory)).filter(n=>n.endsWith('.css')).map(n=>readFile(resolve(directory,n),'utf8')))).join('\n');
 const TasksWorkspace=await workspaceComponent();
 return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><header class="site-header"><strong>JUYU · 本地样例</strong></header>${renderToStaticMarkup(createElement(TasksWorkspace,{data:failed?undefined:data}))}</body></html>`;
}
