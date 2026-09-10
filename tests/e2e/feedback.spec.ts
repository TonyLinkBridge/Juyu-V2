import {test,expect} from '@playwright/test';
import {navigationBrowserBundle} from '../helpers/navigation-browser';
let bundle:Awaited<ReturnType<typeof navigationBrowserBundle>>;
test.beforeAll(async()=>{bundle=await navigationBrowserBundle();});
async function fixture(page:import('@playwright/test').Page,options:{putError?:number;getError?:boolean;delay?:()=>Promise<void>}={}){
 let saved:{helpful:boolean;comment:string|null;version:number;updatedAt:string}|null=null;const bodies:unknown[]=[];
 await page.route('**/api/articles/feedback-page/feedback?**',async route=>{
  if(route.request().method()==='GET')return route.fulfill({status:options.getError?503:200,json:options.getError?{error:'SERVICE_UNAVAILABLE'}:{feedback:saved}});
  const input=route.request().postDataJSON();bodies.push(input);await options.delay?.();
  if(options.putError)return route.fulfill({status:options.putError,json:{error:options.putError===409?'CONFLICT':'SERVICE_UNAVAILABLE'}});
  saved={helpful:input.helpful,comment:input.comment||null,version:(saved?.version??0)+1,updatedAt:'2026-09-08T10:00:00.000Z'};return route.fulfill({json:{feedback:saved}});
 });
 await page.route(url=>url.pathname==='/help-centre',route=>{
 const data=JSON.stringify({pages:[{type:'document',id:'feedback-page',title:'文章反馈 · 本地示例',href:'/help-centre?article=feedback-page'}],requested:'feedback-page',article:{id:'feedback-page',title:'文章反馈 · 本地示例',revision:1,body:'这是一篇用于反馈交互验收的本地示例文章。'},announcement:{id:'feedback',revision:'1',message:'本地验收 · 示例内容'}});
 return route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.css}</style></head><body><div id="presentation"></div><script id="data" type="application/json">${data}</script><script>${bundle.script}</script></body></html>`});
 });return bodies;
}
test('feedback saves only after confirmation, restores on reload and can be changed',async({page},info)=>{
 const bodies=await fixture(page);await page.goto('/help-centre');const form=page.getByRole('region',{name:'文章反馈'});
 await form.getByRole('button',{name:'有帮助',exact:true}).click();await expect(form.getByRole('textbox',{name:'补充说明（选填）'})).toBeFocused();await form.getByRole('textbox',{name:'补充说明（选填）'}).fill('说明清楚');await form.getByRole('button',{name:'提交反馈',exact:true}).click();await expect(form.getByRole('status')).toContainText('反馈已保存');
 await page.reload();await expect(form.getByRole('button',{name:'有帮助',exact:true})).toHaveAttribute('aria-pressed','true');await expect(form.getByRole('textbox')).toHaveValue('说明清楚');
 await form.getByRole('button',{name:'没有帮助',exact:true}).click();await form.getByRole('textbox').fill('请补充例子');await form.getByRole('button',{name:'更新反馈',exact:true}).click();await expect(form.getByRole('status')).toContainText('反馈已保存');
 expect(bodies).toEqual([{revision:1,helpful:true,comment:'说明清楚',expectedVersion:0},{revision:1,helpful:false,comment:'请补充例子',expectedVersion:1}]);
 for(const mode of ['light','dark'] as const){await page.emulateMedia({colorScheme:mode});await expect(page.locator('html')).toHaveAttribute('data-theme',mode);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await page.screenshot({path:`output/verification/feedback-${info.project.name}-${mode}.png`,fullPage:true});}
});
test('failed writes keep input without thanking the employee and duplicate clicks are blocked',async({page})=>{
 let release!:()=>void;const held=new Promise<void>(r=>{release=r});const bodies=await fixture(page,{putError:503,delay:()=>held});await page.goto('/help-centre');const form=page.getByRole('region',{name:'文章反馈'});
 await form.getByRole('button',{name:'没有帮助',exact:true}).click();await form.getByRole('textbox').fill('我需要保留这段输入');await form.getByRole('button',{name:'提交反馈',exact:true}).click();
 await expect(form.getByRole('button',{name:'正在保存…'})).toBeDisabled();expect(bodies.length).toBe(1);release();
 await expect(form.getByRole('alert')).toContainText('未确认保存');await expect(form.getByRole('textbox')).toHaveValue('我需要保留这段输入');await expect(form.getByText('反馈已保存', {exact:false})).toHaveCount(0);
});
test('unavailable feedback does not stop reading and conflicts require rereading before overwrite',async({page})=>{
 await fixture(page,{getError:true});await page.goto('/help-centre');await expect(page.getByRole('heading',{level:1})).toBeVisible();await expect(page.getByRole('button',{name:'重新读取反馈'})).toBeVisible();await expect(page.getByRole('button',{name:'有帮助',exact:true})).toBeDisabled();
 await page.unrouteAll();await fixture(page,{putError:409});await page.reload();const form=page.getByRole('region',{name:'文章反馈'});await form.getByRole('button',{name:'有帮助',exact:true}).click();await form.getByRole('button',{name:'提交反馈',exact:true}).click();await expect(form.getByRole('alert')).toContainText('另一页面');await expect(form.getByRole('button',{name:'提交反馈',exact:true})).toBeDisabled();
});

async function dashboardFixture(page:import('@playwright/test').Page,data:unknown){
 await page.route(url=>url.pathname==='/admin/feedback',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.css}</style></head><body><div id="presentation"></div><script id="data" type="application/json">${JSON.stringify({feedbackDashboard:data}).replace(/</g,'\\u003c')}</script><script>${bundle.script}</script></body></html>`}));
 await page.goto('/admin/feedback');
}
const summary={documentId:'feedback-page',title:'提交审核操作指南 · 本地示例',revision:1,total:2,helpful:1,unhelpful:1,current:false,latestAt:'2026-09-08T10:00:00.000Z'};
test('admin feedback displays versioned counts, safe comments and pagination in both themes',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await dashboardFixture(page,{overview:{items:[summary],total:21,page:1,pages:2}});
 await expect(page.getByRole('list',{name:'文章反馈汇总'})).toContainText('历史版本或已下线');
 await expect(page.getByRole('link',{name:'查看 2 份反馈 →'})).toHaveAttribute('href','/admin/feedback?document=feedback-page&revision=1');
 await expect(page.getByRole('link',{name:'下一页'})).toHaveAttribute('href','/admin/feedback?page=2');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 await page.screenshot({path:`output/verification/feedback-admin-overview-${info.project.name}.png`,fullPage:true});
 await page.unrouteAll();
 await dashboardFixture(page,{details:{summary,entries:[{memberId:'s',memberName:'客服同事（示例）',helpful:true,comment:'步骤清楚，已经找到提交入口。',updatedAt:summary.latestAt},{memberId:'o',memberName:'运营同事（示例）',helpful:false,comment:'请补充审核退回后的操作。\n<script>alert("example")</script>',updatedAt:summary.latestAt}],page:1,pages:1}});
 await expect(page.getByRole('list',{name:'反馈明细'})).toContainText('<script>alert("example")</script>');
 await expect(page.locator('.feedback-message script')).toHaveCount(0);
 for(const mode of ['light','dark'] as const){await page.emulateMedia({colorScheme:mode});await expect(page.locator('html')).toHaveAttribute('data-theme',mode);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await page.screenshot({path:`output/verification/feedback-admin-details-${info.project.name}-${mode}.png`,fullPage:true});}
 expect(errors).toEqual([]);
});
test('empty admin feedback shows a truthful empty state',async({page})=>{
 await dashboardFixture(page,{overview:{items:[],total:0,page:1,pages:1}});
 await expect(page.getByRole('heading',{name:'暂时没有反馈'})).toBeVisible();await expect(page.getByRole('navigation',{name:'反馈分页'})).toHaveCount(0);
});
