import {expect,type Page} from '@playwright/test';
import {navigationBrowserBundle} from './navigation-browser';
import {fieldsBrowserBundle} from './fields-browser';
import {categoriesBrowserBundle} from './categories-browser';
import {formsSettingsBrowserBundle} from './forms-settings-browser';
import {formsBrowserBundle} from './forms-browser';
import {navigationSettingsBrowserBundle} from './navigation-settings-browser';
import {settingHistoryBrowserBundle} from './setting-history-browser';
import {memberBrowserBundle} from './member-browser';
import {historyBrowserBundle,historyPageFixture,historyVersionFixture} from './history-browser';
import {publicationBrowserBundle,publicationFixture} from './publication-browser';
import {availabilityBrowserBundle,availabilityFixture} from './availability-browser';
import {lifecycleBrowserBundle,trashFixture} from './lifecycle-browser';
import {referenceBrowserBundle} from './reference-browser';
import {qaBrowserBundle} from './qa-browser';
import {favoritesBrowserBundle} from './favorites-browser';
import {recentBrowserBundle} from './recent-browser';
import {announcementBrowserBundle} from './announcements-browser';
import {dashboardBrowserBundle} from './analytics-dashboard-browser';
import {controlBrowserBundle,controlFixture} from './control-browser';
import {searchTitles} from '../../src/reader/search';
import {defaultFeatureFlags} from '../../src/features/model';
import {readFile,readdir} from 'node:fs/promises';

type Bundle={css:string;script:string};
type Surface={name:string;build:()=>Promise<Bundle>;root:string;data:unknown;outerTitle?:string;selfMain?:boolean;bodyAttributes?:string;setup?:(page:Page)=>Promise<void>};
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const field={id:id(1),version:1,name:'所属团队',type:'select',required:true,enabled:true,options:['客服','运营']};
const reason={...field,id:id(2),name:'事项说明',type:'text',options:[]};
const category={id:id(3),version:1,name:'运营流程',parentId:null,position:0,audience:'ops',enabled:true};
const form={id:id(4),version:1,title:'异常处理申请 · 本地样例',description:'请填写需要协助的事项。',enabled:true,audience:'staff',fields:[{field,required:true,width:'half'},{field:reason,required:true,width:'full'}]};
const record={id:id(5),formId:form.id,formVersion:1,title:form.title,submittedBy:{id:'support',name:'测试客服'},submittedAt:'2026-09-09T01:00:00Z',status:'new',sequence:0,note:'',processedBy:null,processedAt:null,fields:form.fields,values:[{fieldId:field.id,value:'客服'},{fieldId:reason.id,value:'本地验收事项'}]};
const entry={kind:'features',id:id(6),version:1,label:'功能开关',actor:{id:'admin-a',name:'测试管理员'},changedAt:'2026-09-10T00:00:00Z',restoredFrom:null};
const settingDetail={entry,before:{flags:defaultFeatureFlags},after:{flags:{...defaultFeatureFlags,search:false}},current:{version:2,config:{flags:defaultFeatureFlags}}};
const note={id:id(7),revision:1,title:'新的收藏功能',body:'把常用资料保存到个人收藏，方便重复查阅。',target:'favorites',audience:'staff',enabled:true,seen:false};
const article={id:'a11y-second',title:'域名 EPP 操作 · 本地样例',revision:2,tags:['验收样例'],body:'# 核对步骤\n\n请按正式资料确认。\n\n## 提交资料\n\n核对后再提交。',blocks:[{id:'hint',type:'hint',style:'warning',title:'执行前核对',body:'先确认身份，再检查费用。'},{id:'code',type:'code',language:'javascript',code:'const message = "本地示例";\nconsole.log(message);'},{id:'tabs',type:'tabs',tabs:[{id:'one',title:'注册',body:'注册操作内容'},{id:'two',title:'转入',body:'转入操作内容'}]},{id:'table',type:'table',headers:['项目','说明'],rows:[['EPP','转出核对']]}]};
const pages=[{type:'document' as const,id:article.id,title:article.title,href:`/help-centre?article=${article.id}`}];
const item={...article,kind:'article',savedAt:'2026-09-09T01:00:00Z',viewedAt:'2026-09-09T01:00:00Z',viewedRevision:1};
const detail={...article,tables:[{id:'one',headers:['注册商','办理规则','说明'],rows:[['本地示例','转出 EPP 核对','请按正式资料核对'],['较长的注册商示例名称','续费操作','需要按当前资料核对']]}]};
const feedbackSummary={documentId:article.id,title:article.title,revision:2,total:1,helpful:0,unhelpful:1,current:true,latestAt:'2026-09-09T01:00:00Z'};
const group={fingerprint:'sha256:'+'a'.repeat(64),searches:4,zeroResults:1,clickedSearches:2};
const dashboard={days:30,from:'2026-08-10T01:00:00Z',asOf:'2026-09-09T01:00:00Z',summary:{searches:4,zeroResults:1,clickedSearches:2,searchClicks:7,views:9,feedbackTotal:4,feedbackNegative:1},popularSearches:[group],zeroResultSearches:[group],popularArticles:[{documentId:article.id,title:article.title,kind:'article',revision:2,views:9}],negativeFeedback:[{documentId:article.id,title:article.title,kind:'article',revision:2,total:4,negative:1}]};
export const secondarySurfaces:Surface[]=[
 {name:'search',build:navigationBrowserBundle,root:'presentation',selfMain:true,data:{pages,search:searchTitles(pages,'EPP','1')}},
 {name:'search-empty',build:navigationBrowserBundle,root:'presentation',selfMain:true,data:{pages,search:searchTitles(pages,'不存在的资料','1')}},
 {name:'search-error',build:navigationBrowserBundle,root:'presentation',selfMain:true,data:{pages:[],search:searchTitles([],'EPP','1'),failed:true,retryHref:'/help-centre?q=EPP'}},
 {name:'pdf',build:navigationBrowserBundle,root:'presentation',selfMain:true,data:{pdfSnapshot:{article,files:[]}}},
 {name:'rich-blocks',build:navigationBrowserBundle,root:'presentation',selfMain:true,data:{pages,requested:article.id,article}},
 {name:'fields',build:fieldsBrowserBundle,root:'fields',data:{initial:[field,reason]},setup:async p=>{await p.getByRole('button',{name:/所属团队/}).click();}},
 {name:'fields-empty',build:fieldsBrowserBundle,root:'fields',data:{initial:[]}},
 {name:'fields-error',build:fieldsBrowserBundle,root:'fields',data:{initial:[],state:'unavailable'}},
 {name:'categories',build:categoriesBrowserBundle,root:'categories',data:{initial:[category]},setup:async p=>{await p.getByRole('button',{name:/运营流程/}).click();}},
 {name:'categories-error',build:categoriesBrowserBundle,root:'categories',data:{initial:[],state:'unavailable'}},
 {name:'form-settings',build:formsSettingsBrowserBundle,root:'forms-settings',data:{initial:[form],definitions:[field,reason]},setup:async p=>{await p.getByRole('button',{name:/异常处理申请/}).click();}},
 {name:'form-settings-error',build:formsSettingsBrowserBundle,root:'forms-settings',data:{initial:[],definitions:[],state:'unavailable'}},
 {name:'form-fill',build:formsBrowserBundle,root:'forms',data:{view:'fill',data:form}},
 {name:'form-record',build:formsBrowserBundle,root:'forms',data:{view:'record',data:record}},
 {name:'forms-empty',build:formsBrowserBundle,root:'forms',data:{view:'collection',data:[]}},
 {name:'forms-error',build:formsBrowserBundle,root:'forms',data:{view:'collection'}},
 {name:'navigation-settings',build:navigationSettingsBrowserBundle,root:'navigation-settings',data:{initial:{version:1,entries:[{id:id(8),label:'帮助中心',enabled:true,roles:['support','ops','admin'],target:{type:'page',page:'home'}}]},categories:[category]}},
 {name:'setting-history',build:settingHistoryBrowserBundle,root:'history',data:{initial:{items:[entry],total:1,page:1,pages:1}},setup:async p=>{await p.route('**/api/admin/settings/history/detail?*',r=>r.fulfill({json:{result:settingDetail}}));await p.getByRole('button',{name:'查看 功能开关 版本 1',exact:true}).click();await expect(p.getByRole('region',{name:'版本详情'})).toBeVisible();await expect(p.getByRole('button',{name:'刷新历史列表'})).toBeEnabled();}},
 {name:'setting-history-error',build:settingHistoryBrowserBundle,root:'history',data:{initial:null}},
 {name:'members',build:memberBrowserBundle,root:'panel',outerTitle:'成员与权限 · 本地样例',data:{}},
 {name:'history',build:historyBrowserBundle,root:'root',outerTitle:'历史记录 · 本地样例',bodyAttributes:'data-timeline="1"',data:historyPageFixture},
 {name:'history-version',build:historyBrowserBundle,root:'root',outerTitle:'历史版本 · 本地样例',data:historyVersionFixture},
 {name:'publication',build:publicationBrowserBundle,root:'review',outerTitle:'安排与发布 · 本地样例',data:publicationFixture},
 {name:'availability',build:availabilityBrowserBundle,root:'root',outerTitle:'归档与下线 · 本地样例',data:availabilityFixture},
 {name:'trash',build:lifecycleBrowserBundle,root:'root',selfMain:true,data:trashFixture},
 {name:'reference',build:referenceBrowserBundle,root:'reference',data:{state:'ready',detailState:'ready',data:{items:[detail],total:1,page:1,pages:1,canEdit:false},detail}},
 {name:'qa',build:qaBrowserBundle,root:'qa',data:{state:'ready',data:{items:[{...article,category:'账户操作',position:1}],total:1,page:1,pages:1,canEdit:false}}},
 {name:'favorites',build:favoritesBrowserBundle,root:'favorites',data:{mode:'list',props:{state:'ready',data:{items:[item],total:1,page:1,pages:1}}}},
 {name:'recent',build:recentBrowserBundle,root:'recent',data:{mode:'list',props:{state:'ready',data:{items:[item],total:1,page:1,pages:1}}}},
 {name:'announcements',build:announcementBrowserBundle,root:'announcements',data:{admin:true,initial:[note]},setup:async p=>{await p.getByRole('button',{name:'编辑：'+note.title}).click();}},
 {name:'analytics',build:dashboardBrowserBundle,root:'dashboard',selfMain:true,data:{data:dashboard}},
 {name:'analytics-error',build:dashboardBrowserBundle,root:'dashboard',selfMain:true,data:{state:'unavailable'}},
];
secondarySurfaces.push(
 {name:'feedback-overview',build:navigationBrowserBundle,root:'presentation',selfMain:true,data:{feedbackDashboard:{overview:{items:[feedbackSummary],total:1,page:1,pages:1}}}},
 {name:'feedback-details',build:navigationBrowserBundle,root:'presentation',selfMain:true,data:{feedbackDashboard:{details:{summary:feedbackSummary,entries:[{memberId:'test-support',memberName:'测试客服',helpful:false,comment:'请补充退回修改后的操作步骤。',updatedAt:feedbackSummary.latestAt}],page:1,pages:1}}}},
 {name:'form-records',build:formsBrowserBundle,root:'forms',data:{view:'records',data:{items:[record],total:1,page:1,pages:1}}},
 {name:'review-control',build:controlBrowserBundle,root:'root',outerTitle:'二审管理 · 本地样例',data:controlFixture},
 {name:'archives',build:availabilityBrowserBundle,root:'root',outerTitle:'归档资料 · 本地样例',bodyAttributes:'data-list="1"',data:{items:[{documentId:'archived-local',title:'已归档的本地流程',sequence:8,revision:3}],total:1,page:1,pages:1}},
 {name:'deleted-history',build:historyBrowserBundle,root:'root',outerTitle:'永久删除记录 · 本地样例',bodyAttributes:'data-timeline="2"',data:{items:[{documentId:'deleted-local',title:'已删除的本地样例',sequence:12,actorId:'admin-a',actorName:'测试管理员',deletedAt:'2026-09-09T01:00:00Z'}],total:1,page:1,pages:1}},
 {name:'media',build:navigationBrowserBundle,root:'presentation',selfMain:true,data:{mediaEditor:{documentId:article.id,title:article.title,body:article.body,sequence:2,status:'draft',lifecycle:'active',blocks:article.blocks,cover:null,tags:[],assets:[]}}},
 {name:'science',build:navigationBrowserBundle,root:'presentation',selfMain:true,data:{pages,requested:article.id,article:{...article,blocks:[{id:'math',type:'math',source:'x^2+y^2=z^2',caption:'本地公式'},{id:'diagram',type:'diagram',source:'flowchart LR\nA-->B',caption:'本地流程图'}]}},setup:async p=>{await expect(p.locator('math')).toBeVisible();await expect.poll(()=>p.getByAltText('本地流程图').evaluate(e=>(e as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);}},
);
const bundles=new Map<Surface['build'],Promise<Bundle>>();
let css:Promise<string>|undefined;
export async function mountSecondary(page:Page,surface:Surface){
 let pending=bundles.get(surface.build);if(!pending){pending=surface.build();bundles.set(surface.build,pending);}const bundle=await pending;
 css??=readdir('.next/static/chunks').then(files=>Promise.all(files.filter(f=>f.endsWith('.css')).map(f=>readFile('.next/static/chunks/'+f,'utf8')))).then(files=>files.join('\n'));
 const content=`${surface.outerTitle?`<h1>${surface.outerTitle}</h1>`:''}<div id="${surface.root}"></div>`;
 const plain=/^(fields|categories|form-settings|navigation-settings|setting-history|announcements)/.test(surface.name);
 const pageClass=plain?'':surface.name.startsWith('form')?'forms-main':surface.name==='members'?'members-main':'editor-main search-main';
 const markup=surface.selfMain?content:`<main id="main-content" class="${pageClass}">${content}</main>`;
 const data=JSON.stringify(surface.data).replaceAll('<','\\u003c');
 await page.route('**/api/**',r=>r.fulfill({status:503,json:{error:'LOCAL_FIXTURE_UNAVAILABLE'}}));
 await page.route('**/api/articles/**/diagram?**',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="440" height="120"><rect x="20" y="20" width="140" height="70" rx="8" fill="#e9f4ee" stroke="#26775a"/><text x="65" y="64" font-size="20" fill="#174332">开始</text><path d="M160 55H270m-10 -8 10 8 -10 8" fill="none" stroke="#333"/><rect x="270" y="20" width="140" height="70" rx="8" fill="#e9f4ee" stroke="#26775a"/><text x="315" y="64" font-size="20" fill="#174332">完成</text></svg>'}));
 await page.route('**/api/admin/assets/**',async r=>r.fulfill({contentType:'image/png',body:await readFile('tests/fixtures/article-cover.png')}));
 await page.route('**/__secondary_audit',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-CN"><head><title>JUYU 本地界面验收</title><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.css}</style><style>${compiledCss}</style></head><body ${surface.bodyAttributes??''}>${surface.root==='presentation'?'':'<header class="site-header">JUYU · 本地验收样例，非真实公司资料</header>'}${markup}<script id="data" type="application/json">${data}</script><script>${bundle.script.replaceAll('</script','<\\/script')}</script></body></html>`}));
 const compiledCss=await css;await page.goto('/__secondary_audit');await surface.setup?.(page);
 if(surface.name==='search')await expect(page.getByRole('list',{name:'搜索结果列表'}).getByRole('link')).toHaveCount(1);
 if(surface.name==='search-empty')await expect(page.getByRole('status')).toContainText('找到 0 篇');
 if(surface.name==='search-error')await expect(page.getByRole('heading',{name:/暂时无法/})).toBeVisible();
}
