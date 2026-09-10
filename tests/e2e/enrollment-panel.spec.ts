import {test,expect} from '@playwright/test';
import {enrollmentBrowserBundle} from '../helpers/enrollment-browser';
let bundle:Awaited<ReturnType<typeof enrollmentBrowserBundle>>;
test.beforeAll(async()=>{bundle=await enrollmentBrowserBundle();});
test.beforeEach(async({page})=>{
 await page.route('**/__enrollment_fixture',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.css}</style></head><body><main class="access-main"><p>本地界面测试 · 非真实开通</p><section class="access-card"><h1>开通资料库访问</h1><div id="panel"></div></section></main></body></html>`}));
});
test('automatic enrollment posts no chosen identity and refreshes after verified success',async({page})=>{
 let writes=0,loads=0;
 page.on('request',request=>{if(request.url().endsWith('/__enrollment_fixture'))loads++;});
 await page.route('**/api/auth/enrollment',route=>{writes++;expect(route.request().method()).toBe('POST');expect(route.request().postDataJSON()).toEqual({});return route.fulfill({json:{status:'ready',role:'admin',initialAdmin:true}});});
 await page.goto('/__enrollment_fixture');await page.addScriptTag({content:bundle.script});
 await expect.poll(()=>loads).toBe(2);expect(writes).toBe(1);
});
test('pending enrollment only requests reconciliation and explains a second admin is required',async({page},info)=>{
 let writes=0;
 await page.route('**/api/auth/enrollment',route=>{writes++;return route.fulfill({json:{status:'pending'}});});
 await page.goto('/__enrollment_fixture');await page.addScriptTag({content:bundle.script});
 await expect(page.getByRole('status')).toContainText('开通结果正在核对');expect(writes).toBe(1);
 await page.getByRole('button',{name:'重新核对开通结果'}).click();await expect.poll(()=>writes).toBe(2);await expect(page.getByRole('status')).toContainText('开通结果正在核对');
 await expect(page.getByText(/资料二审需要另一位管理员/)).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBe(false);
 await page.screenshot({path:`output/verification/enrollment-${info.project.name}.png`,fullPage:true});
});
test('waiting and denied enrollment never imply administrator access',async({page})=>{
 let state='waiting';await page.route('**/api/auth/enrollment',route=>route.fulfill(state==='waiting'?{json:{status:'waiting'}}:{status:403,json:{error:'FORBIDDEN'}}));
 await page.goto('/__enrollment_fixture');await page.addScriptTag({content:bundle.script});
 await expect(page.getByRole('status')).toContainText('另一位同事');state='denied';
 await page.getByRole('button',{name:'重新核对开通结果'}).click();await expect(page.getByRole('status')).toContainText('未通过开通检查');
 await expect(page.getByRole('button',{name:'重新核对开通结果'})).toHaveCount(0);await expect(page.getByText('访问已开通')).toHaveCount(0);
});
