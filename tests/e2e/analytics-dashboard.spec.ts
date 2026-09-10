import {test,expect,type Page} from '@playwright/test';
import {dashboardBrowserBundle} from '../helpers/analytics-dashboard-browser';
import type {DashboardData} from '../../src/analytics/dashboard';
let bundle:Awaited<ReturnType<typeof dashboardBrowserBundle>>;
test.beforeAll(async()=>{bundle=await dashboardBrowserBundle();});
const group={fingerprint:'sha256:'+'a'.repeat(64),searches:4,zeroResults:1,clickedSearches:2};
const article={documentId:'formal-local',title:'正式资料 <script>仅文字</script>',kind:'article' as const,revision:3};
const data:DashboardData={days:30,from:'2026-08-10T01:00:00.000Z',asOf:'2026-09-09T01:00:00.000Z',summary:{searches:4,zeroResults:1,clickedSearches:2,searchClicks:7,views:9,feedbackTotal:4,feedbackNegative:1},popularSearches:[group],zeroResultSearches:[group],popularArticles:[{...article,views:9}],negativeFeedback:[{...article,total:4,negative:1}]};
async function mount(page:Page,props:unknown={data}){
 await page.route('**/__dashboard_fixture*',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.css}</style></head><body><header>使用分析 · 本地测试样例（非真实员工数据）</header><div id="dashboard"></div><script id="data" type="application/json">${JSON.stringify(props).replace(/</g,'\\u003c')}</script><script>${bundle.script.replace(/<\/script/gi,'<\\/script')}</script></body></html>`}));await page.goto('/__dashboard_fixture');
}
test('dashboard presents distinct-click rate, formal metadata and fingerprint limits',async({page},info)=>{
 await mount(page);const metrics=page.locator('.analytics-metrics');await expect(metrics).toContainText('50%');await expect(metrics).toContainText('共 7 次结果点击');await expect(metrics).not.toContainText('175%');await expect(metrics).toContainText('25%');
 await expect(page.getByText('搜索词原文未保存', {exact:false})).toBeVisible();await expect(page.locator('abbr').first()).toHaveAttribute('title',group.fingerprint);await expect(page.locator('time').last()).toContainText('09:00');
 await expect(page.getByRole('region',{name:'热门资料',exact:true}).getByRole('link')).toHaveAttribute('href','/help-centre?article=formal-local');await expect(page.getByRole('region',{name:'需要改进的资料',exact:true}).getByRole('link',{name:article.title})).toHaveAttribute('href','/admin/feedback?document=formal-local&revision=3');await expect(page.locator('main script')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const table=page.getByRole('region',{name:'热门搜索分组表格，可横向滚动'});await table.focus();await expect(table).toBeFocused();if(info.project.name==='mobile')expect(await table.evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
 await page.screenshot({path:`output/verification/dashboard-${info.project.name}.png`,fullPage:true,animations:'disabled'});await page.evaluate(()=>document.documentElement.dataset.theme='dark');await expect.poll(()=>page.locator('html').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(25, 25, 31)');await page.screenshot({path:`output/verification/dashboard-dark-${info.project.name}.png`,fullPage:true,animations:'disabled'});
});
test('dashboard range form navigates with only the selected supported period',async({page})=>{
 await mount(page);const select=page.getByLabel('统计范围');await expect(select).toHaveValue('30');await select.focus();await expect(select).toBeFocused();await select.selectOption('7');
 await page.route('**/admin/analytics?days=7',r=>r.fulfill({contentType:'text/html',body:'<p>Range fixture</p>'}));await page.getByRole('button',{name:'查看统计'}).click();await expect(page).toHaveURL(/\/admin\/analytics\?days=7$/);
 await mount(page,{data:{...data,days:90}});await expect(page.getByLabel('统计范围')).toHaveValue('90');await expect(page.getByRole('link',{name:'刷新统计'})).toHaveAttribute('href','/admin/analytics?days=90');
});
test('dashboard zero data has no fabricated rates and failures suppress supplied stale data',async({page})=>{
 await mount(page,{data:{...data,summary:{searches:0,zeroResults:0,clickedSearches:0,searchClicks:0,views:0,feedbackTotal:0,feedbackNegative:0},popularSearches:[],zeroResultSearches:[],popularArticles:[],negativeFeedback:[]}});
 await expect(page.getByRole('status')).toContainText('暂无可展示的数据');await expect(page.locator('.analytics-metrics')).toContainText('—');await expect(page.locator('.analytics-metrics')).not.toContainText('0%');
 for(const state of ['unavailable','denied','invalid']){await page.unrouteAll();await mount(page,{state,data});await expect(page.getByRole('alert')).toBeVisible();await expect(page.locator('.analytics-metrics')).toHaveCount(0);await expect(page.getByRole('link',{name:article.title})).toHaveCount(0);await expect(page.getByRole('status')).toHaveCount(0);}
});
test('actual dashboard requires configured identity and rejects forged admin headers',async({page,request})=>{
 const response=await request.get('/api/admin/analytics?days=30',{headers:{'x-role':'admin','x-user-id':'other'}});expect(response.status()).toBe(503);expect(response.headers()['cache-control']).toBe('private, no-store');expect(await response.json()).toEqual({error:'ANALYTICS_UNAVAILABLE'});expect((await request.post('/api/admin/analytics',{data:{days:30}})).status()).toBe(405);await page.goto('/admin/analytics');await expect(page).toHaveURL(/\/admin\/sign-in$/);
});
