import {test,expect} from '@playwright/test';
import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {readFile,readdir} from 'node:fs/promises';
import {loadOpsViews} from '../helpers/ops-view';
let views:NonNullable<Awaited<ReturnType<typeof loadOpsViews>>>,css:string;
test.beforeAll(async()=>{views=(await loadOpsViews())!;css=(await Promise.all((await readdir('.next/static/chunks')).filter(n=>n.endsWith('.css')).map(n=>readFile(`.next/static/chunks/${n}`,'utf8')))).join('\n')+await readFile('src/app/globals.css','utf8');});
async function html(pageNo=1,state:'ready'|'denied'|'unavailable'='ready',empty=false){
 const data={items:empty?[]:[{id:pageNo===1?'ops-procedure':'ops-escalation',title:pageNo===1?'运营异常处理 <script>只作文字</script>':'升级处理流程',revision:2,tags:['内部流程','正式资料']}],total:empty?0:31,page:pageNo,pages:empty?1:2};
 return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><header>OPS Internal · 本地测试样例（非真实资料）</header><main id="main-content" class="editor-main search-main">${renderToStaticMarkup(createElement(views.OpsCollection,{data,state}))}</main></body></html>`;
}
test('OPS published collection reads pagination links safely on desktop and mobile',async({page},info)=>{
 await page.route('**/__ops_fixture*',r=>r.fulfill({contentType:'text/html',body:''}));await page.route(url=>url.pathname==='/help-centre/ops',async r=>r.fulfill({contentType:'text/html',body:await html(Number(new URL(r.request().url()).searchParams.get('page')??1))}));
 await page.goto('/help-centre/ops');await expect(page.getByRole('heading',{name:'OPS Internal',exact:true})).toBeVisible();await expect(page.getByRole('status')).toContainText('共 31 篇');const link=page.getByRole('link',{name:'阅读：运营异常处理 <script>只作文字</script>',exact:true});await expect(link).toHaveAttribute('href','/help-centre?article=ops-procedure');await expect(page.getByText('内部流程 · 正式资料',{exact:true})).toBeVisible();await expect(page.getByRole('button')).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`output/verification/ops-${info.project.name}.png`,fullPage:true,animations:'disabled'});await page.getByRole('link',{name:'下一页',exact:true}).click();await expect(page.getByRole('link',{name:'阅读：升级处理流程'})).toHaveAttribute('href','/help-centre?article=ops-escalation');await expect(page.getByRole('status')).toContainText('第 2 / 2 页');await page.getByRole('link',{name:'上一页',exact:true}).click();await expect(link).toBeVisible();
 await page.mouse.move(0,0);await page.evaluate(()=>document.documentElement.dataset.theme='dark');await expect(page.getByRole('link',{name:'下一页',exact:true})).toHaveCSS('background-color','rgb(34, 34, 41)');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`output/verification/ops-dark-${info.project.name}.png`,fullPage:true,animations:'disabled'});
});
test('OPS denial and load errors expose no items tags counts or empty-success wording',async({page})=>{
 for(const state of ['denied','unavailable'] as const){await page.route('**/__ops_fixture',async r=>r.fulfill({contentType:'text/html',body:await html(1,state)}));await page.goto('/__ops_fixture');await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByRole('list',{name:'已发布运营资料'})).toHaveCount(0);await expect(page.getByText(/共 31/)).toHaveCount(0);await expect(page.getByText('内部流程 · 正式资料',{exact:true})).toHaveCount(0);await expect(page.getByText('暂时没有已发布的运营资料',{exact:true})).toHaveCount(0);await page.unroute('**/__ops_fixture');}
 await page.route('**/__ops_fixture',async r=>r.fulfill({contentType:'text/html',body:await html(1,'ready',true)}));await page.goto('/__ops_fixture');await expect(page.getByRole('heading',{name:'暂时没有已发布的运营资料'})).toBeVisible();await expect(page.getByRole('alert')).toHaveCount(0);
});
test('OPS entry renders only with server-granted visibility',async({page})=>{
 for(const allowed of [false,true]){await page.setContent(renderToStaticMarkup(createElement(views.OpsEntryLink,{allowed})));await expect(page.getByRole('link',{name:'OPS Internal',exact:true})).toHaveCount(allowed?1:0);if(allowed)await expect(page.getByRole('link')).toHaveAttribute('href','/help-centre/ops');}
});
test('actual OPS endpoint and entry reject unconfigured forged accounts',async({page,request})=>{
 const r=await request.get('/api/ops?page=1',{headers:{'x-role':'ops','x-user-id':'staff'}});expect(r.status()).toBe(503);expect(r.headers()['cache-control']).toBe('private, no-store');expect(await r.json()).toEqual({error:'OPS_UNAVAILABLE'});await page.goto('/help-centre/ops');await expect(page).toHaveURL(/\/sign-in$/);await expect(page.getByRole('list',{name:'已发布运营资料'})).toHaveCount(0);
});
