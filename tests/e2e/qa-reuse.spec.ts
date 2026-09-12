import {test,expect,type Page} from '@playwright/test';
import {navigationBrowserBundle} from '../helpers/navigation-browser';
let bundle:Awaited<ReturnType<typeof navigationBrowserBundle>>;
test.beforeAll(async()=>{bundle=await navigationBrowserBundle();});
const answer={id:'qa-local',title:'如何核对账户？',revision:2,body:'标准答案：请核对账户资料。',blocks:[]};
async function mount(page:Page){
 await page.route('**/__qa_reuse',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.css}</style></head><body><div id="presentation"></div><script id="data" type="application/json">${JSON.stringify({qaAnswer:{id:answer.id,title:answer.title,revision:2}})}</script><script>${bundle.script.replaceAll('</script','<\\/script')}</script></body></html>`}));await page.goto('/__qa_reuse');
}
const toggle=(page:Page)=>page.getByRole('button',{name:/如何核对账户/});
test('R11 reopening a fresh answer reuses it without a loading flash or request',async({page})=>{
 let reads=0;await page.route('**/api/qa/qa-local',r=>{reads++;return r.fulfill({json:answer});});await mount(page);await toggle(page).click();await expect(page.getByText(answer.body,{exact:true})).toBeVisible();
 for(let i=0;i<3;i++){await toggle(page).click();await expect(page.getByText(answer.body,{exact:true})).toHaveCount(0);await toggle(page).click();await expect(page.getByText(answer.body,{exact:true})).toBeVisible();await expect(page.getByText('正在读取标准答案…')).toHaveCount(0);}expect(reads).toBe(1);
});
test('R11 focus revalidation discards revoked answers and retry obtains the current version',async({page})=>{
 let reads=0;await page.route('**/api/qa/qa-local',r=>{reads++;return reads===1?r.fulfill({json:answer}):reads===2?r.fulfill({status:403,json:{error:'FORBIDDEN'}}):r.fulfill({json:{...answer,revision:3,body:'新版标准答案'}});});await mount(page);await toggle(page).click();await expect(page.getByText(answer.body,{exact:true})).toBeVisible();
 await page.evaluate(()=>dispatchEvent(new Event('blur')));await expect(page.getByText(answer.body,{exact:true})).toHaveCount(0);await page.evaluate(()=>dispatchEvent(new Event('focus')));await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByText(answer.body,{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'重新读取'}).click();await expect(page.getByText('新版标准答案',{exact:true})).toBeVisible();expect(reads).toBe(3);
});
test('R11 expired answer is revalidated and a failed request cannot expose the old body',async({page})=>{
 await page.clock.install();let reads=0;await page.route('**/api/qa/qa-local',r=>{reads++;return reads===1?r.fulfill({json:answer}):r.fulfill({status:503});});await mount(page);await toggle(page).click();await expect(page.getByText(answer.body,{exact:true})).toBeVisible();await page.clock.runFor(30_001);await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByText(answer.body,{exact:true})).toHaveCount(0);expect(reads).toBe(2);
});
test('R11 closed expired answers revalidate only when opened and malformed answers are rejected',async({page})=>{
 await page.clock.install();let reads=0;await page.route('**/api/qa/qa-local',r=>{reads++;return r.fulfill({json:reads===1?answer:{...answer,id:'another-question'}});});await mount(page);await toggle(page).click();await expect(page.getByText(answer.body,{exact:true})).toBeVisible();await toggle(page).click();await page.clock.runFor(30_001);expect(reads).toBe(1);await toggle(page).click();await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByText(answer.body,{exact:true})).toHaveCount(0);expect(reads).toBe(2);
});
test('R11 an expired deep link checks the server again rather than showing its retained answer',async({page})=>{
 await page.clock.install();let reads=0;await page.route('**/api/qa/qa-local',r=>{reads++;return reads===1?r.fulfill({json:answer}):r.fulfill({json:{...answer,revision:3,body:'重新核对后的答案'}});});await mount(page);await toggle(page).click();await expect(page.getByText(answer.body,{exact:true})).toBeVisible();await toggle(page).click();await page.clock.runFor(30_001);await page.evaluate(()=>{location.hash='qa-qa-local';});await expect(page.getByText('重新核对后的答案',{exact:true})).toBeVisible();await expect(page.getByText(answer.body,{exact:true})).toHaveCount(0);expect(reads).toBe(2);
});
