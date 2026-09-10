import {encodeEditorBody} from '../../../editor/document';
import {notFound} from 'next/navigation';
import Link from 'next/link';
import {EntryShell} from '../../../components/entry-shell';
import {AdminFrame} from '../../../components/shell/AdminFrame';
import {KnowledgeHome} from '../../../components/home/KnowledgeHome';
import {ReaderQuickLinks} from '../../../components/navigation-settings/ReaderQuickLinks';
import {ReaderNavigation} from '../../../components/reader-navigation';
import {SearchInput} from '../../../components/gitbook/Search/SearchInput';
import {TasksWorkspace} from '../../../components/tasks/TasksWorkspace';
import {ReviewDecision} from '../../../components/review/ReviewDecision';
import {workspaceQuery,type WorkspaceData} from '../../../workspace/model';
import type {NavigationNode} from '../../../reader/tree';
// Local fixture only. No real route/API authorization is bypassed.
export default async function DesignPreview({params}:{params:Promise<{screen:string}>}){
 if(process.env.NODE_ENV!=='development'||process.env.JUYU_DESIGN_PREVIEW!=='true')notFound();
 const {screen}=await params;
 const titles=['域名转入操作指南','客户身份核验','费用与续费规则','异常升级处理'];
 const pages:NavigationNode[]=[{type:'group',id:'start',title:'新人上手',descendants:[{type:'document',id:'intro',title:'开始使用资料库',href:'/design-preview/article?article=intro'}]},{type:'group',id:'domains',title:'域名业务',descendants:titles.map((title,i)=>({type:'document',id:`preview-${i}`,title,href:`/design-preview/article?article=preview-${i}`}))}];
 const menu=[{id:'home',label:'首页',href:'/design-preview/home'},{id:'knowledge',label:'知识资料',href:'/design-preview/article'},{id:'reference',label:'Reference 速查',href:'/help-centre/reference'},{id:'qa',label:'Q&A 问答',href:'/help-centre/qa'},{id:'ops',label:'OPS Internal',href:'/help-centre/ops'},{id:'favorites',label:'收藏',href:'/help-centre/favorites'},{id:'recent',label:'最近浏览',href:'/help-centre/recent'}];
 const text=(id:string,type:string,value:string)=>({id,type,props:{},content:[{type:'text',text:value,styles:{}}],children:[]});
 const body=encodeEditorBody([
  text('check','heading','转入前检查'),text('check-intro','paragraph','在处理业务前，请先核对客户授权、当前注册商要求与域名状态。'),
  {id:'check-hint',type:'juyu',props:{payload:JSON.stringify({id:'check-hint',type:'hint',style:'info',title:'请先核对注册商规则与客户授权。',body:'不同注册商要求可能不同。以下为界面示例，请以正式发布的业务规则为准。'})},children:[]},
  text('step-one','numberedListItem','确认域名状态与客户身份'),text('step-two','numberedListItem','核对有效授权材料'),text('step-three','numberedListItem','确认当前处理步骤'),
  text('submit','heading','提交转入'),text('submit-intro','paragraph','按照正式流程提交申请，并记录操作结果。'),
  {id:'check-table',type:'juyu',props:{payload:JSON.stringify({id:'check-table',type:'table',headers:['检查项','处理方式'],rows:[['授权材料','核对有效性与客户授权'],['状态异常','记录原因并交给指定人员处理']]})},children:[]},
  text('exceptions','heading','异常处理'),text('exception-intro','paragraph','遇到无法确认的情况，请查阅对应的升级流程。')
 ]);
 const data:WorkspaceData={query:workspaceQuery({view:'list',scope:'all'}),items:titles.map((title,i)=>({id:`preview-${i}`,title,kind:'article',status:i<2?'in_review':i===2?'published':'draft',revision:8,publishedRevision:i===2?8:null,updatedAt:'2026-09-10T02:24:00Z',author:'Tony',editor:'Tony',submitter:'Tony',reviewer:i===3?null:'Ivy',canReview:i<2})),counts:{draft:1,in_review:2,changes_requested:0,approved:0,queued:0,published:1},total:4,page:1,pages:1};
 const notice=<nav className="preview-banner" aria-label="设计预览页面"><span>本地预览 · 示例内容，不代表正式资料</span>{[['home','首页'],['article','文章'],['admin','工作台'],['review','审核']].map(([id,label])=><Link key={id} href={`/design-preview/${id}`}>{label}</Link>)}</nav>;
 if(screen==='home')return <>{notice}<EntryShell search={<SearchInput/>} navigation={<ReaderQuickLinks items={menu} currentHref="/design-preview/home"/>}><KnowledgeHome pages={pages} menu={menu.filter(i=>['knowledge','reference','qa'].includes(i.id))} latest={titles.map((title,i)=>({id:`preview-${i}`,title,updated:'2026-09-10T02:24:00Z'}))} recent={titles.map((title,i)=>({id:`preview-${i}`,title,kind:'article',revision:8,tags:[],viewedRevision:8,viewedAt:'2026-09-10T02:24:00Z'}))} admin/></EntryShell></>;
 if(screen==='article')return <>{notice}<EntryShell search={<SearchInput/>}><ReaderNavigation pages={pages} requested="preview-0" article={{id:'preview-0',title:titles[0],revision:8,body}}/></EntryShell></>;
 if(screen==='admin')return <>{notice}<AdminFrame><TasksWorkspace data={data}/></AdminFrame></>;
 if(screen==='review')return <>{notice}<AdminFrame><main id="main-content" className="editor-main"><p className="back-link">内容管理 / 待我审核</p><h1>二审处理</h1><ReviewDecision initial={{article:{documentId:'preview-0',title:titles[0],body,sequence:4,status:'in_review',lifecycle:'active',blocks:[],cover:null,tags:[],assets:[],kind:'article',audience:'staff',publishedRevision:1},review:{revision:8,submittedBy:'preview-tony',reviewerId:'preview-ivy',reviewerName:'Ivy',status:'in_review',reason:null,submittedAt:'2026-09-10T09:30:00Z',decidedAt:null},canDecide:true}}/></main></AdminFrame></>;
 notFound();
}
