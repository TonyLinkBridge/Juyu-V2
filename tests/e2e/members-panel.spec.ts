import {test,expect} from '@playwright/test';
import {memberBrowserBundle,memberFixture} from '../helpers/member-browser';
let bundle:Awaited<ReturnType<typeof memberBrowserBundle>>;
test.beforeAll(async()=>{bundle=await memberBrowserBundle();});
test.beforeEach(async({page})=>{
 // Isolated client fixture: this URL is intercepted by the test, never implemented by the app.
 await page.route('**/__member_fixture',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.css}</style></head><body><main class="members-main"><p>本地界面测试 · 非真实成员</p><h1>成员与权限</h1><div id="panel"></div></main></body></html>`}));
 await page.goto('/__member_fixture');await page.addScriptTag({content:bundle.script});
});
test('member roles require confirmation, self controls are disabled, and successful writes refresh',async({page},info)=>{
 await expect(page.getByRole('heading',{name:'成员与权限',exact:true})).toBeVisible();
 await expect(page.getByText('本地界面测试 · 非真实成员',{exact:true})).toBeVisible();
 await expect(page.getByLabel('admin@company.test 的角色')).toBeDisabled();
 const updated=structuredClone(memberFixture);updated.members[1].role='ops';
 let writes=0;
 await page.route('**/api/admin/members/staff-a',async route=>{writes++;expect(route.request().postDataJSON()).toEqual({type:'role',role:'ops',expectedRole:'support'});await route.fulfill({json:{status:'applied'}});});
 await page.route('**/api/admin/members',route=>route.fulfill({json:updated}));
 await page.getByLabel('support@company.test 的角色').selectOption('ops');
 await expect(page.getByRole('region',{name:'确认成员修改'})).toBeVisible();expect(writes).toBe(0);
 await page.getByRole('button',{name:'取消',exact:true}).click();expect(writes).toBe(0);
 await page.getByLabel('support@company.test 的角色').selectOption('ops');await page.getByRole('button',{name:'确认修改',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('操作已完成');expect(writes).toBe(1);
 await expect(page.getByLabel('support@company.test 的角色')).toHaveValue('ops');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBe(false);
 await page.screenshot({path:`output/verification/members-${info.project.name}.png`,fullPage:true});
});
test('pending writes display recovery and block changes until verified, failures never show success',async({page})=>{
 const pending=structuredClone(memberFixture);pending.members[1].pending=true;pending.operations=[{id:'00000000-0000-0000-0000-000000000015',actor_id:'admin-a',target_id:'staff-a',kind:'role',before_role:'support',requested_role:'ops',requested_disabled:null,observed_role:null,status:'pending',created_at:'2026-09-08T10:00:00Z',finished_at:null,reconciled_by:null}];
 await page.route('**/api/admin/members/staff-a',route=>route.fulfill({json:{status:'pending'}}));
 await page.route('**/api/admin/members',route=>route.fulfill({json:pending}));
 await page.route('**/api/admin/members/operations/*',route=>route.fulfill({status:503,json:{error:'SERVICE_UNAVAILABLE'}}));
 await page.getByLabel('support@company.test 的角色').selectOption('ops');await page.getByRole('button',{name:'确认修改',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('暂时无法确认');await expect(page.getByLabel('ops@company.test 的角色')).toBeDisabled();
 await page.getByRole('button',{name:'核对结果',exact:true}).click();await expect(page.getByRole('status')).toContainText('暂时不可用');
 await expect(page.getByText('操作已完成并记录。')).toHaveCount(0);
});

test('pending new account is identified and its ordinary member controls are disabled',async({page})=>{
 const pending=structuredClone(memberFixture);pending.members[1].pending=true;pending.members[1].enrollment_pending=true;
 await page.route('**/api/admin/members',route=>route.fulfill({json:pending}));
 await page.getByRole('button',{name:'刷新成员'}).click();
 const card=page.getByRole('article').filter({has:page.getByRole('heading',{name:'测试客服',exact:true})});
 await expect(card.getByText('等待开通核对',{exact:true})).toBeVisible();
 await expect(card.getByLabel('support@company.test 的角色')).toBeDisabled();await expect(card.getByRole('button',{name:'停用访问'})).toBeDisabled();
 await expect(card.getByText(/请该成员登录资料库/)).toBeVisible();
 await expect(page.getByLabel('ops@company.test 的角色')).toBeEnabled();
});
