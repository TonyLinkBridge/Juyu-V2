import {FavoriteButton} from '../../../components/favorites/FavoriteButton';
import '../../forms-settings.css';
import {OpsCollection} from '../../../components/ops/OpsCollection';
import {FormSettings} from '../../../components/forms/FormSettings';
import {LoginScreen} from '../../../components/login-screen';
import {LoginPreview} from '../../../components/login-preview';
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
 if(screen==='login-light'||screen==='login-dark')return <LoginScreen audience={screen==='login-dark'?'admin':'employee'}><LoginPreview/></LoginScreen>;
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
 if(screen==='home')return <>{notice}<EntryShell account navigation={<ReaderQuickLinks items={menu} currentHref="/design-preview/home"/>}><KnowledgeHome pages={pages} menu={menu.filter(i=>['knowledge','reference','qa'].includes(i.id))} latest={titles.map((title,i)=>({id:`preview-${i}`,title,updated:'2026-09-10T02:24:00Z'}))} recent={titles.map((title,i)=>({id:`preview-${i}`,title,kind:'article',revision:8,tags:[],viewedRevision:8,viewedAt:'2026-09-10T02:24:00Z'}))} admin/></EntryShell></>;
 if(screen==='ops')return <>{notice}<EntryShell search={<SearchInput/>} navigation={<ReaderQuickLinks items={menu} currentHref="/help-centre/ops"/>}><main id="main-content" className="search-main"><OpsCollection state="ready" data={{items:[],total:0,page:1,pages:1}}/></main></EntryShell></>;
 if(screen==='forms')return <>{notice}<AdminFrame><main id="main-content"><FormSettings initial={[]} definitions={[]} state="ready"/></main></AdminFrame></>;
 if(screen==='article-email'){
  const emailPages:NavigationNode[]=[{type:'group',id:'accounts',title:'账户管理',descendants:[{type:'group',id:'security',title:'账户安全',descendants:[{type:'document',id:'email-preview',title:'如何修改账户邮箱',href:'/design-preview/article-email'}]}]}];
  const heading=(id:string,value:string)=>({...text(id,'heading',value),props:{level:2}});
  const emailBody=encodeEditorBody([heading('email-process','修改账户邮箱流程'),text('email-intro','paragraph','账户邮箱是您登录本站的重要账户凭证，请务必妥善保管。目前暂不支持用户自助修改，需要提交【有问必答】，等待专员审核处理。'),heading('email-steps','具体操作流程'),...['登录网站后，进入【管理中心 → 有问必答 → 我要提问】；','工单类型选择「修改账户邮箱」；','工单标题填写您的具体需求；','根据页面提示填写相关资料；','填写修改原因并完成身份验证；','等待专员审核，结果通过工单同步。'].map((value,i)=>text(`email-step-${i}`,'numberedListItem',value)),heading('email-login','无法登录时如何申请'),{id:'email-red',type:'paragraph',content:[{type:'text',text:'账户在',styles:{}},{type:'text',text:'无法正常登录',styles:{textColor:'red',bold:true}},{type:'text',text:'的情况下，可通过邮件形式申请。',styles:{}}],children:[]},text('email-subject','paragraph','邮件主题：申请修改账户绑定邮箱')]);
  return <>{notice}<EntryShell search={<SearchInput/>}><ReaderNavigation pages={emailPages} requested="email-preview" article={{id:'email-preview',title:'如何修改账户邮箱',revision:22,body:emailBody}} articleActions={<FavoriteButton documentId="email-preview" revision={22} initial={{documentId:"email-preview",revision:22,saved:false}}/>}/></EntryShell></>;
 }
 if(screen==='article'||screen==='article-plain')return <>{notice}<EntryShell search={<SearchInput/>}><ReaderNavigation pages={pages} requested="preview-0" article={{id:'preview-0',title:titles[0],revision:8,body:screen==='article-plain'?encodeEditorBody([text('intro','paragraph','这是没有章节标题的文章示例，用于检查正文宽度和换行。资料应让员工快速找到处理步骤，而不是在整块屏幕上横向追踪文字。'),text('detail','paragraph','登录后，请先核对账户资料，并按照已审核发布的流程处理。遇到无法确认的情况，请联系负责人员。'),{id:'colored',type:'paragraph',content:[{type:'text',text:'这段红色加粗提示保持编辑时的格式。',styles:{textColor:'red',bold:true}}],children:[]}]):body}} articleActions={<button type="button" className="secondary-link" disabled aria-label="收藏文章（仅布局示例）">收藏文章</button>}/></EntryShell></>;
 if(screen==='admin')return <>{notice}<AdminFrame><TasksWorkspace data={data}/></AdminFrame></>;
 if(screen==='review')return <>{notice}<AdminFrame><main id="main-content" className="editor-main"><p className="back-link">内容管理 / 待我审核</p><h1>二审处理</h1><ReviewDecision initial={{article:{documentId:'preview-0',title:titles[0],body,sequence:4,status:'in_review',lifecycle:'active',blocks:[],cover:null,tags:[],assets:[],kind:'article',audience:'staff',publishedRevision:1},review:{revision:8,submittedBy:'preview-tony',reviewerId:'preview-ivy',reviewerName:'Ivy',status:'in_review',reason:null,submittedAt:'2026-09-10T09:30:00Z',decidedAt:null},canDecide:true}}/></main></AdminFrame></>;
 notFound();
}
