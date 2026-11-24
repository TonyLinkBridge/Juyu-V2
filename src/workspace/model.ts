import type {ContentKind,Status} from '../domain/model.ts';
export const statuses:ReadonlyArray<{id:Status;name:string}>= [
 {id:'draft',name:'草稿'},{id:'in_review',name:'等待审核'},{id:'changes_requested',name:'需要修改'},
 {id:'approved',name:'已经批准'},{id:'queued',name:'等待发布'},{id:'published',name:'已经发布'},
];
export const scopes={all:'全部内容',submitted:'我提交的',review:'等我审核',returned:'退回给我的'} as const;
export const kinds={article:'知识文章',ops:'OPS Internal',reference:'Reference',qa:'Q&A'} as const;
export type QueryInput=Record<string,string|string[]|undefined>;
export interface WorkspaceQuery {q:string;scope:keyof typeof scopes;kind:ContentKind|'all';status:Status|'all';page:number;view:'board'|'list'|'cards'}
export interface WorkspaceItem {categoryPaths?:string[];publishedCategoryPaths?:string[];publicationNumber?:number|null;qaCategory?:string;qaPosition?:number;id:string;title:string;kind:ContentKind;status:Status;sequence:number;revision:number;publishedRevision:number|null;updatedAt:string;author:string;editor:string;submitter:string|null;reviewer:string|null;canReview?:boolean;canWithdrawSubmission?:boolean}
export interface WorkspaceData {canBulkWithdraw?:boolean;query:WorkspaceQuery;items:WorkspaceItem[];counts:Record<Status,number>;total:number;page:number;pages:number}
export function workspaceQuery(input:QueryInput={}):WorkspaceQuery {
 const read=(key:string,fallback:string)=>{const v=input[key];if(v===undefined)return fallback;if(typeof v!=='string')throw new Error('INVALID_QUERY');return v;};
 const q=read('q','').trim(),scope=read('scope','all'),kind=read('kind','all'),status=read('status','all'),view=read('view','board'),page=read('page','1');
 if(q.length>120||/[\u0000-\u001f]/.test(q)||!Object.hasOwn(scopes,scope)||!(kind==='all'||Object.hasOwn(kinds,kind))||!(status==='all'||statuses.some(s=>s.id===status))||!['board','list','cards'].includes(view)||!/^\d{1,9}$/.test(page)||Number(page)<1)throw new Error('INVALID_QUERY');
 return {q,scope:scope as WorkspaceQuery['scope'],kind:kind as WorkspaceQuery['kind'],status:status as WorkspaceQuery['status'],view:view as WorkspaceQuery['view'],page:Number(page)};
}
export function workspaceHref(query:WorkspaceQuery,patch:Partial<WorkspaceQuery>={}) {
 const q={...query,...patch};const params=new URLSearchParams();
 for(const [key,value] of Object.entries(q))params.set(key,String(value));
 return `/admin?${params}`;
}
export function workspaceItemDestination(task:Pick<WorkspaceItem,'id'|'kind'|'status'|'canReview'>){
 const article='?article='+encodeURIComponent(task.id);
 if(task.status==='in_review'){
  const href='/admin/review'+article;
  return {href,actionHref:href,label:task.canReview?'处理审核':'查看审核'};
 }
 if(task.status==='approved'||task.status==='queued'){
  const href='/admin/review/publish'+article;
  return {href,actionHref:href+'&intent=publish_now',label:'立即发布'};
 }
 const href='/admin/editor'+article;
 return {href,actionHref:href,label:task.kind==='qa'?'编辑问答':'编辑文章'};
}
export function publicationLabel(item:Pick<WorkspaceItem,'revision'|'publishedRevision'|'status'|'publicationNumber'>){
 const version=item.publicationNumber?` ${item.publicationNumber}`:'';
 return item.publishedRevision===null?'尚未发布':item.status==='published'?(version?`正式版${version}`:'已发布'):`旧正式版${version} 仍可阅读`;
}

export function contentManagementHref(kind?:ContentKind):string {
 return kind==='ops'||kind==='reference'||kind==='qa'?`/admin?kind=${kind}&view=list`:'/admin';
}

/** Explain working Q&A metadata without implying it is already visible to readers. */
export function qaPublicationNotice(item:Pick<WorkspaceItem,'kind'|'publishedRevision'>&{status:string},locale:'zh-CN'|'en'='zh-CN'):string|null {
 if(item.kind!=='qa'||!['approved','queued'].includes(item.status))return null;
 if(item.publishedRevision!==null)return locale==='en'?'This revision is not published. Employees still see the published content and categories.':'本次修订尚未发布；员工仍看到正式版内容和分类。';
 return locale==='en'?(item.status==='approved'?'Approved, but not published. The category is not yet visible on the employee page.':'Awaiting publication. The category is not yet visible on the employee page.'):(item.status==='approved'?'已批准，尚未发布；分类暂不显示在员工页面。':'等待正式发布；分类暂不显示在员工页面。');
}
