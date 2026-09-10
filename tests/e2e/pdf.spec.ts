import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {navigationBrowserBundle} from '../helpers/navigation-browser';
let bundle:Awaited<ReturnType<typeof navigationBrowserBundle>>;
test.beforeAll(async()=>{bundle=await navigationBrowserBundle();});
const snapshot={article:{id:'pdf-test',revision:1,title:'PDF 阅读 · 本地示例',body:'# 查阅流程\n核对当前正式版本。\n\n| 项目 | 操作 |\n| --- | --- |\n| 注册 | 核实身份 |\n| 续费 | 检查费用 |'},files:[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',filename:'费用表（本地示例）.pdf',size:'100'}]};
async function fixture(page:import('@playwright/test').Page){
 await page.route(url=>url.pathname==='/help-centre/pdf',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.css}</style></head><body><div id="presentation"></div><script id="data" type="application/json">${JSON.stringify({pdfSnapshot:snapshot})}</script><script>${bundle.script}</script></body></html>`}));
 await page.route('**/api/assets/**',async route=>route.fulfill({contentType:'application/pdf',body:await readFile('output/pdf/T026-local-verification.pdf')}));
 await page.goto('/help-centre/pdf?article=pdf-test&revision=1');
}
test('PDF reading keeps Chinese tables, attachment controls and print layout on desktop and mobile',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await fixture(page);
 await expect(page.getByRole('heading',{name:'PDF 阅读 · 本地示例'})).toBeVisible();await expect(page.getByRole('columnheader',{name:'项目'})).toBeVisible();
 await page.getByText('费用表（本地示例）.pdf',{exact:true}).click();await expect(page.getByRole('link',{name:'打开文件：费用表（本地示例）.pdf'})).toHaveAttribute('href','/api/assets/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 await expect(page.getByTitle('PDF：费用表（本地示例）.pdf')).toBeVisible();await page.getByText('费用表（本地示例）.pdf',{exact:true}).click();
 for(const mode of ['light','dark'] as const){await page.emulateMedia({colorScheme:mode});await expect(page.locator('html')).toHaveAttribute('data-theme',mode);await expect(page.locator('.pdf-actions .secondary-link').first()).toHaveCSS('background-color',mode==='dark'?'rgb(34, 34, 41)':'rgb(255, 255, 255)');expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await page.screenshot({path:`output/verification/pdf-reader-${info.project.name}-${mode}.png`,fullPage:true,animations:'disabled'});}
 await page.emulateMedia({media:'print'});await expect(page.getByRole('button',{name:'下载 PDF',exact:true})).not.toBeVisible();await expect(page.getByRole('columnheader',{name:'项目'})).toBeVisible();expect(errors).toEqual([]);
});
test('PDF download waits for success, keeps errors honest, and can retry',async({page})=>{
 await fixture(page);let succeed=false;
 await page.route('**/api/articles/pdf-test/pdf?**',async route=>route.fulfill(succeed?{contentType:'application/pdf',body:await readFile('output/pdf/T026-local-verification.pdf')}:{status:409,json:{error:'VERSION_CHANGED'}}));
 await page.getByRole('button',{name:'下载 PDF',exact:true}).click();await expect(page.getByRole('status')).toContainText('文章已更新');await expect(page.getByText('PDF 已生成',{exact:false})).toHaveCount(0);
 succeed=true;const pending=page.waitForEvent('download');await page.getByRole('button',{name:'下载 PDF',exact:true}).click();const download=await pending;expect(download.suggestedFilename()).toBe('article-v1.pdf');await expect(page.getByRole('status')).toContainText('已交给浏览器下载');
});
test('print action rechecks current permission and revision before opening browser print',async({page})=>{
 await fixture(page);await page.evaluate(()=>{window.print=()=>{document.body.dataset.printed='yes';};});let allowed=false;
 await page.route('**/api/articles/pdf-test/pdf?**',route=>route.fulfill(allowed?{json:{revision:1,coverId:null}}:{status:404,json:{error:'NOT_FOUND'}}));
 await page.getByRole('button',{name:'打印此页'}).click();await expect(page.getByRole('alert')).toContainText('无法确认');expect(await page.locator('body').getAttribute('data-printed')).toBeNull();allowed=true;await page.getByRole('button',{name:'打印此页'}).click();await expect(page.locator('body')).toHaveAttribute('data-printed','yes');
});
