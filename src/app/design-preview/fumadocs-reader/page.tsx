import type {Root} from 'fumadocs-core/page-tree';
import {DocsLayout} from 'fumadocs-ui/layouts/docs';
import {DocsBody,DocsDescription,DocsPage,DocsTitle} from 'fumadocs-ui/layouts/docs/page';
import {notFound,redirect} from 'next/navigation';
import {FumadocsBlockNoteReader} from '../../../components/fumadocs/FumadocsBlockNoteReader';
import {FumadocsPublicationI18n} from '../../../components/fumadocs/FumadocsPublicationI18n';
import {FumadocsPublicationActions,FumadocsPublicationFeedback} from '../../../components/fumadocs/FumadocsPublicationActions';
import {canonicalFumadocsPublicationPath} from '../../../fumadocs/publication';
import type {EditorBlock,EditorTextProps} from '../../../editor/document';
import {encodeTabBody} from '../../../media/tab-body';
import {inlineEmbedHref} from '../../../editor/inline-embed';
import {defaultFeatureFlags} from '../../../features/model';
import type {Publication} from '../../../reader/body';
import type {NavigationNode} from '../../../reader/tree';
import type {TitleSearch} from '../../../reader/search';
import {FumadocsDirectoryContent} from '../../../components/fumadocs/FumadocsDirectoryState';
import {FumadocsKnowledgeHomeContent} from '../../../components/fumadocs/FumadocsKnowledgeHome';
import {FumadocsSearchContent} from '../../../components/fumadocs/FumadocsSearchPage';
import {FumadocsOpsContent} from '../../../components/fumadocs/FumadocsOpsPage';
import {FumadocsReferenceContent} from '../../../components/fumadocs/FumadocsReferencePage';
import {FumadocsQaContent} from '../../../components/fumadocs/FumadocsQaPage';
import {FumadocsFavoritesPreviewContent} from '../../../components/fumadocs/FumadocsFavoritesPage';
import {FumadocsRecentContent} from '../../../components/fumadocs/FumadocsRecentPage';
import {FumadocsFormsContent} from '../../../components/fumadocs/FumadocsFormsPage';
import {FumadocsFormFillContent} from '../../../components/fumadocs/FumadocsFormFillPage';
import {FumadocsChangelogContent} from '../../../components/fumadocs/FumadocsChangelogPage';
import {FumadocsPDFContent} from '../../../components/fumadocs/FumadocsPDFPage';

export const dynamic='force-dynamic';

const path='/design-preview/fumadocs-reader';
const tree:Root={
 name:'资料目录',
 children:[{type:'folder',name:'资料目录',root:true,defaultOpen:true,children:[
  {type:'folder',name:'账户管理',children:[
   {type:'page',name:'如何修改账户邮箱',url:path},
   {type:'page',name:'如何找回密码',url:`${path}/example-password`},
  ]},
  {type:'folder',name:'交易与订单',children:[{type:'page',name:'订单状态说明',url:`${path}/example-orders`}]},
 ]}],
};

const fixtureReferencePages=[{id:'account-security-checklist',title:'账户安全检查清单',description:'核对身份、邮箱和登录验证状态。',href:canonicalFumadocsPublicationPath('account-security-checklist')}];

const text=(value:string,styles:Record<string,string|boolean>={})=>[{type:'text' as const,text:value,styles}];
const textProps={textAlignment:'left' as const,textColor:'default',backgroundColor:'default'};
const cell=(value:string)=>({type:'tableCell' as const,props:{...textProps},content:text(value)});
const blocks:EditorBlock[]=[
 {id:'email-process',type:'heading',props:{...textProps,level:1},content:text('修改账户邮箱流程'),children:[]},
 {id:'email-intro',type:'paragraph',props:textProps,content:text('账户邮箱是登录本站的重要凭证。修改前请先完成身份核对，并确认新邮箱可以正常收信。',{textColor:'#000000'}),children:[]},
 {id:'email-inline-content',type:'paragraph',props:textProps,content:[
  {type:'text',text:'请查看 ',styles:{}},
  {type:'link',href:'https://example.com/security',content:text('账户安全规则',{bold:true})},
  {type:'text',text:'，并识别 ',styles:{}},
  {type:'link',href:inlineEmbedHref({type:'icon',icon:'shield'}),content:text('安全图标')},
  {type:'text',text:'、',styles:{}},
  {type:'link',href:inlineEmbedHref({type:'math',source:'x^2+y^2=z^2'}),content:text('勾股公式')},
  {type:'text',text:' 与 ',styles:{}},
  {type:'link',href:inlineEmbedHref({type:'image',assetId:'88888888-8888-4888-8888-888888888888'}),content:text('账户验证截图')},
  {type:'text',text:'。',styles:{}},
 ],children:[]},
 {id:'email-callout',type:'juyu',props:{payload:JSON.stringify({id:'email-callout',type:'hint',style:'warning',title:'操作前确认',body:'请先准备账户验证资料。'})},children:[
  {id:'email-callout-detail',type:'paragraph',props:textProps,content:[{type:'text',text:'先核实身份，再查看',styles:{bold:true}},{type:'link',href:'https://example.com/rules',content:text('处理规则')}],children:[]},
 ]},
 {id:'email-tabs',type:'juyu',props:{payload:JSON.stringify({id:'email-tabs',type:'tabs',tabs:[
  {id:'self-service',title:'自行处理',body:encodeTabBody([{id:'self-service-body',type:'paragraph',props:textProps,content:[{type:'text',text:'先打开账户设置，再查看',styles:{bold:true}},{type:'link',href:'https://example.com/account',content:text('账户操作说明')}],children:[]}]),iconKey:'book'},
  {id:'staff-support',title:'专员协助',body:'无法登录时，请联系专员核对身份。',iconKey:'users'},
 ]})},children:[]},
 {id:'email-steps',type:'juyu',props:{payload:JSON.stringify({id:'email-steps',type:'steps',steps:[
  {id:'verify-profile',title:'核对账户资料',body:encodeTabBody([{id:'verify-profile-body',type:'paragraph',props:textProps,content:[{type:'text',text:'准备账户 ID，并确认',styles:{bold:true}},{type:'link',href:'https://example.com/identity',content:text('身份资料要求')}],children:[]}])},
  {id:'submit-request',title:'提交修改申请',body:'填写新邮箱后提交申请，并等待专员回复。'},
 ]})},children:[]},
 {id:'email-columns',type:'juyu',props:{payload:JSON.stringify({id:'email-columns',type:'columns',columns:[
  {id:'required-details',title:'需要准备',body:encodeTabBody([{id:'required-details-body',type:'paragraph',props:textProps,content:[{type:'text',text:'准备账户 ID、原绑定邮箱，并查看',styles:{bold:true}},{type:'link',href:'https://example.com/requirements',content:text('完整资料要求')}],children:[]}])},
  {id:'processing-method',title:'处理方式',body:'完成资料核对后，通过工单提交修改申请。'},
  {id:'review-result',title:'审核结果',body:'审核完成后，结果会发送至新邮箱。'},
 ]})},children:[]},
 {id:'email-table',type:'table',props:{textColor:'default',borderData:JSON.stringify({'0:0':{bottom:{width:3,color:'#cc2233'}},'1:0':{right:{width:2,color:'#cc2233'}}}),verticalAlignData:JSON.stringify({'1:0':'middle','1:1':'bottom'})},content:{type:'tableContent',columnWidths:[220,360],headerRows:1,rows:[
  {cells:[{...cell('账户资料'),props:{...textProps,colspan:2}}]},
  {cells:[{...cell('基本资料'),props:{...textProps,rowspan:2}},cell('账户 ID')]},
  {cells:[cell('新邮箱及验证资料')]},
 ]},children:[]},
 {id:'email-code',type:'codeBlock',props:{language:'javascript'} as unknown as EditorTextProps,content:text('const account = "JUYU";\nconsole.log(account);'),children:[]},
 {id:'email-advanced-code',type:'juyu',props:{payload:JSON.stringify({id:'email-advanced-code',type:'code',language:'typescript',title:'account.ts',code:'const account = "JUYU";\nconst active = true;\nconsole.log(account);\nconsole.warn("legacy");\nif (active) {\n  console.log("ready");\n}',lineNumbers:true,wrap:true,expandable:true,collapsedLines:3,highlightLines:'2',addedLines:'3',removedLines:'4'})},children:[]},
 {id:'email-native-image',type:'image',props:{backgroundColor:'default',textAlignment:'right',name:'账户设置截图',url:'/api/assets/11111111-1111-4111-8111-111111111111',caption:'BlockNote 图片：保留 280px 宽度及靠右位置。',showPreview:true,previewWidth:280},children:[]},
 {id:'email-theme-image',type:'juyu',props:{payload:JSON.stringify({id:'email-theme-image',type:'image',assetId:'22222222-2222-4222-8222-222222222222',darkAssetId:'33333333-3333-4333-8333-333333333333',caption:'深色主题会使用对应图片。',alt:'帮助中心主题示例'})},children:[]},
 {id:'email-native-video',type:'video',props:{backgroundColor:'default',textAlignment:'center',name:'邮箱修改示范影片',url:'/api/assets/44444444-4444-4444-8444-444444444444',caption:'BlockNote 影片：保留 360px 宽度及居中位置。',showPreview:true,previewWidth:360},children:[]},
 {id:'email-native-audio',type:'audio',props:{backgroundColor:'default',name:'语音操作说明',url:'/api/assets/55555555-5555-4555-8555-555555555555',caption:'邮箱修改语音说明',showPreview:true},children:[]},
 {id:'email-native-file',type:'file',props:{backgroundColor:'default',name:'邮箱修改申请表.pdf',url:'/api/assets/66666666-6666-4666-8666-666666666666',caption:'填写后交给账户专员。'},children:[]},
 {id:'email-advanced-file',type:'juyu',props:{payload:JSON.stringify({id:'email-advanced-file',type:'file',assetId:'77777777-7777-4777-8777-777777777777',caption:'高级附件也使用同一套文件显示。',alt:'身份资料清单.pdf'})},children:[]},
 {id:'email-math',type:'juyu',props:{payload:JSON.stringify({id:'email-math',type:'math',source:'\\frac{a+b}{2}=x^2',caption:'账户验证计算公式'})},children:[]},
 {id:'email-diagram',type:'juyu',props:{payload:JSON.stringify({id:'email-diagram',type:'diagram',source:'flowchart LR\n A[提交] --> B[审核] --> C[完成]',caption:'邮箱修改审核流程'})},children:[]},
 {id:'email-advanced-grid',type:'juyu',props:{payload:JSON.stringify({id:'email-advanced-grid',type:'table',headers:['状态','说明'],rows:[['开放','可以申请'],['关闭','暂停申请'],['开放','等待审核']],view:'grid',searchable:true,stickyHeader:true,stickyFirstColumn:true})},children:[]},
 {id:'email-advanced-cards',type:'juyu',props:{payload:JSON.stringify({id:'email-advanced-cards',type:'table',headers:['资料','用途'],rows:[['身份证明','核实身份'],['充值记录','确认账户']],view:'cards',searchable:false})},children:[]},
 {id:'email-reusable-content',type:'juyu',props:{payload:JSON.stringify({id:'email-reusable-content',type:'reusableContent',familyId:'99999999-9999-4999-8999-999999999999',version:3,title:'账户安全共用说明'})},children:[
  {id:'email-reusable-paragraph',type:'paragraph',props:textProps,content:[{type:'text',text:'这是已经审核的共用内容，请按照',styles:{}},{type:'link',href:'https://example.com/shared-policy',content:text('账户安全规范',{bold:true})},{type:'text',text:'处理。',styles:{}}],children:[]},
 ]},
 {id:'email-reference',type:'juyu',props:{payload:JSON.stringify({id:'email-reference',type:'articleReference',targetId:'account-security-checklist'})},children:[]},
 {id:'email-restricted-reference',type:'juyu',props:{payload:JSON.stringify({id:'email-restricted-reference',type:'articleReference',targetId:'restricted-account-guide'})},children:[]},
 {id:'email-primary-button',type:'juyu',props:{payload:JSON.stringify({id:'email-primary-button',type:'button',label:'打开账户中心',href:'https://example.com/account',variant:'primary'})},children:[]},
 {id:'email-secondary-button',type:'juyu',props:{payload:JSON.stringify({id:'email-secondary-button',type:'button',label:'查看内部表单',href:'/help-centre/forms',variant:'secondary'})},children:[]},
 {id:'email-youtube-embed',type:'juyu',props:{payload:JSON.stringify({id:'email-youtube-embed',type:'externalEmbed',url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',caption:'邮箱修改操作影片'})},children:[]},
 {id:'email-external-link',type:'juyu',props:{payload:JSON.stringify({id:'email-external-link',type:'externalEmbed',url:'https://example.com/account-guide',caption:'账户操作补充说明'})},children:[]},
 {id:'email-result',type:'heading',props:{...textProps,level:1},content:text('提交后会发生什么'),children:[]},
 {id:'email-result-body',type:'paragraph',props:textProps,content:text('专员审核后会通过工单回复结果。请不要重复提交相同申请。'),children:[]},
];

const toc=[
 {title:'修改账户邮箱流程',url:'#email-process',depth:2},
 {title:'提交后会发生什么',url:'#email-result',depth:2},
];

const plainPath=`${path}?fixture=plain`;
const plainTree:Root={
 name:'资料目录',
 children:[{type:'folder',name:'资料目录',root:true,defaultOpen:true,children:[
  {type:'folder',name:'示例文章',children:[
   {type:'page',name:'没有章节标题的文章',url:plainPath},
  ]},
 ]}],
};
const plainBlocks:EditorBlock[]=[
 {id:'plain-intro',type:'paragraph',props:textProps,content:text('这是没有章节标题的文章示例，用于检查正文宽度和换行。'),children:[]},
 {id:'plain-detail',type:'paragraph',props:textProps,content:text('资料应让员工快速找到处理步骤，而不是在整块屏幕上横向追踪文字。登录后，请先核对账户资料，并按照已审核发布的流程处理。'),children:[]},
 {id:'plain-highlight',type:'paragraph',props:textProps,content:text('这段红色加粗提示保持编辑时的格式。',{textColor:'red',bold:true}),children:[]},
];

const fixtureArticle:Publication={id:'fumadocs-preview',title:'如何修改账户邮箱',revision:1,body:'',locale:'zh-CN',publicationNumber:1,feedback:{memberId:'preview',value:null}};
const plainFixtureArticle:Publication={id:'fumadocs-preview-plain',title:'没有章节标题的文章',revision:1,body:'',locale:'zh-CN',publicationNumber:1,feedback:{memberId:'preview',value:null}};
const fixtureLanguages={'zh-CN':path,en:`${path}?lang=en`} as const;
const directoryPages:NavigationNode[]=[{type:'group',id:'preview-account',title:'账户管理',descendants:[
 {type:'document',id:'fumadocs-preview',title:'如何修改账户邮箱',href:'/help-centre/articles/fumadocs-preview'},
 {type:'document',id:'example-password',title:'如何找回密码',href:'/help-centre/articles/example-password'},
]}];
const fixtureSearch:TitleSearch={status:'ready',query:'信用',total:2,page:1,pages:1,results:[
 {id:'credit',title:'0 元签约店铺信用额度如何理解？',href:'/help-centre/qa?question=credit',breadcrumbs:['信用额度'],kind:'qa',revision:1,tags:['0 元签约','店铺'],snippet:'了解签约店铺和信用额度的使用规则。'},
 {id:'credit-article',title:'如何申请信用额度？',href:'/help-centre/articles/credit-article',breadcrumbs:['店铺管理'],kind:'article',revision:1,tags:['信用额度'],snippet:'提交信用额度申请前需要准备的资料。'},
]};
const homeMenu=[
 {id:'00000000-0000-4000-8000-000000000001',label:'帮助中心',href:'/help-centre'},
 {id:'00000000-0000-4000-8000-000000000002',label:'OPS Internal',href:'/help-centre/ops'},
 {id:'00000000-0000-4000-8000-000000000003',label:'Reference 速查',href:'/help-centre/reference'},
 {id:'00000000-0000-4000-8000-000000000004',label:'Q&A 问答',href:'/help-centre/qa'},
];
const fixtureOps={items:[
 {id:'ops-procedure',title:'运营异常处理',revision:2,tags:['内部流程','正式资料']},
 {id:'ops-escalation',title:'升级处理流程',revision:1,tags:['升级处理']},
],total:2,page:1,pages:1};
const fixtureReferenceData={items:[
 {id:'reference-fees',title:'域名费用速查',revision:3,publicationNumber:2,tags:['费用','注册商']},
 {id:'reference-rules',title:'业务规则速查',revision:1,publicationNumber:1,tags:['规则']},
],total:2,page:1,pages:1,canEdit:false};
const fixtureReferenceDetail={...fixtureReferenceData.items[0],tables:[{
 id:'fees',headers:['注册商','项目','规则'],rows:[
  ['示例注册商 A','转入','提交前核对费用'],
  ['示例注册商 B','续费','到期前完成续费'],
 ],
}]};
const fixtureQaData={
 items:[],total:0,page:1,pages:1,canEdit:false,q:'',
 categories:['账户管理','信用额度'],topics:['0 元签约','签约店铺'],
};
const fixtureFavoritesData={items:[
 {id:'favorite-account',title:'如何修改账户邮箱',kind:'article' as const,revision:3,tags:['账户安全'],savedAt:'2026-09-25T03:00:00.000Z'},
 {id:'favorite-credit',title:'0 元签约店铺信用额度如何理解？',kind:'qa' as const,revision:1,tags:['信用额度','签约店铺'],savedAt:'2026-09-25T02:00:00.000Z'},
],total:2,page:1,pages:1};
const fixtureRecentData={items:[
 {id:'recent-account',title:'如何修改账户邮箱',kind:'article' as const,revision:3,viewedRevision:3,tags:['账户安全'],viewedAt:'2026-09-25T03:00:00.000Z'},
 {id:'recent-credit',title:'0 元签约店铺信用额度如何理解？',kind:'qa' as const,revision:2,viewedRevision:1,tags:['信用额度','签约店铺'],viewedAt:'2026-09-25T02:00:00.000Z'},
],total:2,page:1,pages:1};
const fixtureFormsData=[
 {id:'00000000-0000-4000-8000-000000000010',version:1,title:'账户资料变更申请',description:'提交需要管理员协助处理的账户资料变更。',audience:'staff' as const,enabled:true,fields:[{field:{id:'00000000-0000-4000-8000-000000000011',version:1,enabled:true,name:'变更说明',type:'text' as const,required:true,options:[]},required:true,width:'full' as const}]},
 {id:'00000000-0000-4000-8000-000000000012',version:1,title:'异常处理申请',description:'说明遇到的情况，并提交给管理员跟进。',audience:'staff' as const,enabled:true,fields:[{field:{id:'00000000-0000-4000-8000-000000000013',version:1,enabled:true,name:'问题说明',type:'text' as const,required:true,options:[]},required:true,width:'full' as const},{field:{id:'00000000-0000-4000-8000-000000000014',version:1,enabled:true,name:'需要升级',type:'boolean' as const,required:false,options:[]},required:false,width:'half' as const}]},
];
const fixtureChangelogData={items:[
 {id:'update-account',kind:'article' as const,title:'如何修改账户邮箱',at:'2026-09-25T02:00:00.000Z',publicationNumber:2,releaseNote:'第二版：补充无法登录时的处理步骤。\n同步更新所需验证资料。'},
 {id:'update-credit',kind:'qa' as const,title:'0 元签约店铺信用额度如何理解？',at:'2026-09-24T03:00:00.000Z',publicationNumber:1,releaseNote:'首次发布标准答案。'},
],page:2,hasMore:true};
const fixturePDFSnapshot={article:{...fixtureArticle,title:'PDF 阅读 · 正式资料示例',body:'# 查阅流程\n核对当前正式版本。\n\n| 项目 | 操作 |\n| --- | --- |\n| 注册 | 核实身份 |\n| 续费 | 检查费用 |'},files:[]};

function fixture(kind:'default'|'plain'='default'){
 const plain=kind==='plain';
 const article=plain?plainFixtureArticle:fixtureArticle;
 const currentPath=plain?plainPath:path;
 return <FumadocsPublicationI18n locale="zh-CN" destinations={plain?{'zh-CN':plainPath}:fixtureLanguages}><DocsLayout tree={plain?plainTree:tree} nav={{title:'JUYU Help Centre',url:currentPath}} searchToggle={{enabled:false}}>
  <DocsPage data-fumadocs-publication="" toc={plain?[]:toc} breadcrumb={{includeRoot:{url:currentPath},includePage:true}}>
   <DocsTitle>{article.title}</DocsTitle>
   <DocsDescription>{plain?'正文没有章节标题时，Fumadocs 不会制造本页目录。':'使用 Fumadocs 官方阅读外壳和 BlockNote 官方只读视图显示同一份文章内容。'}</DocsDescription>
   <FumadocsPublicationActions article={article} features={defaultFeatureFlags}/>
   <DocsBody><FumadocsBlockNoteReader blocks={plain?plainBlocks:blocks} published locale="zh-CN" documentId={article.id} revision={1} referencePages={plain?[]:fixtureReferencePages}/></DocsBody>
   <FumadocsPublicationFeedback article={article} features={defaultFeatureFlags}/>
  </DocsPage>
 </DocsLayout></FumadocsPublicationI18n>;
}

export default async function FumadocsReaderPreview({searchParams}:{searchParams:Promise<{article?:string|string[];fixture?:string|string[];lang?:string|string[]}>}){
 const {article:requested,fixture:fixtureKind}=await searchParams;
 if(requested===undefined){
  if(process.env.NODE_ENV!=='development'||process.env.JUYU_DESIGN_PREVIEW!=='true')notFound();
  if(fixtureKind===undefined)return fixture();
  if(fixtureKind==='plain')return fixture('plain');
  if(fixtureKind==='directory')return <FumadocsDirectoryContent pages={directoryPages} features={{search:true}}/>;
  if(fixtureKind==='directory-error')return <FumadocsDirectoryContent pages={[]} features={{search:true}} failed retryHref={`${path}?fixture=directory-error`}/>;
  if(fixtureKind==='home')return <FumadocsKnowledgeHomeContent pages={directoryPages} menu={homeMenu} latest={[{id:'fumadocs-preview',title:'如何修改账户邮箱',updated:'2026-09-25T01:00:00.000Z'}]} recent={[{id:'fumadocs-preview',title:'如何修改账户邮箱',kind:'article',revision:1,publicationNumber:1,tags:['账户安全'],viewedRevision:1,viewedAt:'2026-09-25T02:00:00.000Z'}]} search showRecent locale="zh-CN"/>;
  if(fixtureKind==='search')return <FumadocsSearchContent pages={directoryPages} features={{search:true,analytics:false}} search={fixtureSearch} scope="all" retryHref={`${path}?fixture=search`}/>;
  if(fixtureKind==='ops')return <FumadocsOpsContent data={fixtureOps} state="ready" menu={homeMenu} search locale="zh-CN"/>;
  if(fixtureKind==='reference')return <FumadocsReferenceContent data={fixtureReferenceData} detail={fixtureReferenceDetail} state="ready" detailState="ready" menu={homeMenu} search locale="zh-CN"/>;
  if(fixtureKind==='qa')return <FumadocsQaContent data={fixtureQaData} state="ready" menu={homeMenu} searchEnabled locale="zh-CN"/>;
  if(fixtureKind==='favorites')return <FumadocsFavoritesPreviewContent data={fixtureFavoritesData} state="ready" menu={homeMenu} search locale="zh-CN"/>;
  if(fixtureKind==='recent')return <FumadocsRecentContent data={fixtureRecentData} state="ready" menu={homeMenu} search locale="zh-CN"/>;
  if(fixtureKind==='forms')return <FumadocsFormsContent data={fixtureFormsData} state="ready" menu={homeMenu} search/>;
  if(fixtureKind==='form-fill')return <FumadocsFormFillContent data={fixtureFormsData[1]} state="ready" menu={homeMenu} search/>;
  if(fixtureKind==='changelog')return <FumadocsChangelogContent data={fixtureChangelogData} state="ready" menu={homeMenu} search locale="zh-CN"/>;
  if(fixtureKind==='pdf')return <FumadocsPDFContent snapshot={fixturePDFSnapshot} state="ready" menu={homeMenu} search locale="zh-CN"/>;
  notFound();
 }
 if(fixtureKind!==undefined)notFound();
 if(typeof requested!=='string'||!requested.trim()||requested.length>200)notFound();
 redirect(canonicalFumadocsPublicationPath(requested));
}
