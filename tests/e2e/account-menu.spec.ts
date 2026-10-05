import {readFile} from 'node:fs/promises';
import type {AxeResults} from 'axe-core';
import {test,expect,type Page} from '@playwright/test';
import {accountMenuBundle} from '../helpers/account-menu-browser';
let bundle:Awaited<ReturnType<typeof accountMenuBundle>>;
test.beforeAll(async()=>{bundle=await accountMenuBundle();});
async function mount(page:Page,query=''){
 await page.route('**/__account-fixture*',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.css}</style></head><body><header class="app-topbar"><strong>JUYU · 本地账号测试</strong>${query.includes("sidebar")?'':'<div id="account" style="margin-left:auto"></div>'}</header>${query.includes("sidebar")?'<aside class="fumadocs-sidebar-account" style="position:fixed;left:16px;bottom:20px;width:228px"><div id="account"></div></aside>':''}<main style="padding:32px"><h1>账号菜单验收</h1><p>仅使用测试身份，不连接真实账号。</p><p id="profile-result"></p><p id="logout-result"></p><p id="logout-success"></p><p id="guard-result"></p><button>页面内容</button></main><script>${bundle.script.replace(/<\/script/gi,'<\\/script')}</script></body></html>`}));
 await page.goto('/__account-fixture'+query);
 await page.locator('.account-controls').locator('[aria-haspopup="menu"]').click();await expect(page.getByRole('menu')).toBeFocused();
}

test('account identity retains JUYU data and the external official theme survives reload',async({page},info)=>{
 await mount(page);const menu=page.getByRole('menu');await expect(menu).toBeVisible();
 await expect(menu).toContainText('Haley QA');await expect(menu).toContainText('haley-qa@example.test');await expect(menu).toContainText('超级管理员');
 await expect(menu.getByText('Billing',{exact:true})).toHaveCount(0);await expect(menu.getByText('Pro',{exact:true})).toHaveCount(0);
 await expect(menu.getByRole('group',{name:'外观',exact:true})).toHaveCount(0);
 await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);
 const theme=page.locator('.account-controls>[data-theme-toggle]');await theme.click();await expect(page.locator('html')).toHaveClass(/dark/);
 await page.reload();await expect(page.locator('html')).toHaveClass(/dark/);expect(await page.evaluate(()=>localStorage.getItem('theme'))).toBe('dark');
 await theme.click();await expect(page.locator('html')).toHaveClass(/light/);
 await page.locator('[aria-haspopup="menu"]').click();await expect(menu).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(info.project.name==='mobile'){await expect(menu).toHaveCSS('position','fixed');expect(await page.locator('html').evaluate(el=>el.style.overflow)).toBe('hidden');}
 await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);await expect(page.locator('[aria-haspopup="menu"]')).toBeFocused();
 expect(await page.locator('html').evaluate(el=>el.style.overflow)).not.toBe('hidden');
});

test('cancelled editor logout keeps local copies and does not call Clerk',async({page})=>{
 await mount(page,'?guard=1');await page.evaluate(()=>localStorage.setItem('juyu:editor-recovery:v1:test:draft','draft'));await page.getByRole('menuitem',{name:'退出登录',exact:true}).click();
 await expect(page.getByRole('menu')).toBeVisible();await expect(page.locator('#logout-result')).toBeEmpty();await expect(page.locator('#guard-result')).toBeEmpty();
 expect(await page.evaluate(()=>localStorage.getItem('juyu:editor-recovery:v1:test:draft'))).toBe('draft');await expect(page.getByRole('menuitem',{name:'退出登录',exact:true})).toBeEnabled();
});

test('failed logout stays actionable, resets leave protection and retries the current session',async({page})=>{
 await mount(page,'?logout-fails=1&delay=1');const exit=page.getByRole('menuitem',{name:'退出登录',exact:true});await exit.click();await expect(page.getByRole('menuitem',{name:'正在退出…',exact:true})).toHaveAttribute('aria-busy','true');
 await expect(page.getByRole('alert')).toContainText('退出未成功');await expect(page.getByRole('menu')).toBeVisible();await expect(page.locator('#guard-result')).toHaveText('reset');
 await page.getByRole('menuitem',{name:'退出登录',exact:true}).click();await expect(page.locator('#logout-success')).toHaveText('已退出测试会话');await expect(page.getByRole('menu')).toHaveCount(0);
 const result=JSON.parse(await page.locator('#logout-result').innerText());expect(result).toEqual({attempts:2,options:{sessionId:'sess_local_qa',redirectUrl:'/admin/sign-in'}});
});

test('account settings failure remains visible and missing sessions cannot logout',async({page})=>{
 await mount(page,'?profile-fails=1');await page.getByRole('menuitem',{name:'账号设置',exact:true}).click();await expect(page.getByRole('alert')).toContainText('账号设置暂时无法打开');await expect(page.getByRole('menu')).toBeVisible();
 await mount(page,'?no-session=1');await expect(page.getByRole('menuitem',{name:'退出登录',exact:true})).toBeDisabled();await expect(page.getByRole('status')).toContainText('当前登录会话尚未确认');
});

test('keyboard navigation opens real settings without obsolete theme menu items',async({page})=>{
 await mount(page,'?lang=en');await expect(page.getByRole('menu')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('menu')).toHaveCount(0);const trigger=page.getByRole('button',{name:'Account menu, Haley QA',exact:true});await trigger.press('ArrowDown');
 await expect(page.getByRole('menuitem',{name:'Account settings',exact:true})).toBeFocused();await page.keyboard.press('Enter');await expect(page.locator('#profile-result')).toHaveText('账号设置已打开');await expect(page.getByRole('menu')).toHaveCount(0);
 await trigger.click();await expect(page.getByRole('group',{name:'Appearance',exact:true})).toHaveCount(0);await expect(page.getByRole('menuitemradio')).toHaveCount(0);await expect(page.getByRole('menu')).toContainText('Super Admin');
});

// Verify the rendered menu semantics rather than its implementation class names.
test('account menu has valid accessible controls in light and dark themes',async({page})=>{
 await mount(page);await expect(page.getByRole('menu')).toHaveCSS('opacity','1');await expect(page.getByRole('menuitem',{name:'账号设置',exact:true})).toHaveCSS('opacity','1');await expect(page.getByRole('menuitem',{name:'退出登录',exact:true})).toHaveCSS('opacity','1');await page.addScriptTag({content:await readFile('node_modules/axe-core/axe.min.js','utf8')});
 for(const theme of ['dark','light']){await page.keyboard.press('Escape');await expect(page.getByRole('menu')).toHaveCount(0);await page.locator('.account-controls>[data-theme-toggle]').click();await expect(page.locator('html')).toHaveClass(new RegExp(theme));await page.locator('[aria-haspopup="menu"]').click();await expect(page.getByRole('menu')).toHaveCSS('opacity','1');
  await page.evaluate(async()=>{await new Promise<void>(done=>requestAnimationFrame(()=>done()));await Promise.all(document.querySelector('[role="menu"]')!.getAnimations({subtree:true}).map(animation=>animation.finished.catch(()=>{})));});
  const result=await page.evaluate(async()=>await (window as unknown as {axe:{run(context:unknown,options:unknown):Promise<AxeResults>}}).axe.run('[role="menu"]',{runOnly:['aria-allowed-attr','aria-required-children','aria-required-parent','button-name','color-contrast']}));
  expect(result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);
 }
});

test('employee menu retains its role and uses the employee current-session logout destination',async({page})=>{
 await mount(page,'?reader=1&role=ops&lang=en');const menu=page.getByRole('menu');await expect(menu).toContainText('Ops');await expect(menu.getByRole('menuitem',{name:'Admin console',exact:true})).toHaveCount(0);
 await menu.getByRole('menuitem',{name:'Sign out',exact:true}).click();await expect(page.locator('#logout-success')).toHaveText('已退出测试会话');await expect(menu).toHaveCount(0);
 expect(JSON.parse(await page.locator('#logout-result').innerText())).toEqual({attempts:1,options:{sessionId:'sess_local_qa',redirectUrl:'/sign-in'}});
});

test('menu repositions when feedback height or its responsive surface changes',async({page},info)=>{
 await mount(page,'?reader=1&sidebar=1&profile-fails=1');await page.getByRole('menuitem',{name:'账号设置',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible();
 const anchor=()=>page.evaluate(()=>{const m=document.querySelector('[role="menu"]')!.getBoundingClientRect(),t=document.querySelector('[aria-haspopup="menu"]')!.getBoundingClientRect();return {above:m.bottom<=t.y-7,inside:m.x>=0&&m.y>=0&&m.right<=innerWidth&&m.bottom<=innerHeight};});
 if(info.project.name==='desktop')await expect.poll(async()=> (await anchor()).above).toBe(true);
 await page.setViewportSize({width:390,height:844});await expect(page.getByRole('menu')).toHaveCount(1);await expect(page.getByRole('menu')).toHaveCSS('opacity','1');await expect.poll(async()=> (await anchor()).inside).toBe(true);
 await page.setViewportSize({width:1440,height:900});await expect(page.getByRole('menu')).toHaveCount(1);await expect(page.getByRole('menu')).toHaveCSS('opacity','1');await expect.poll(async()=> (await anchor()).above&&(await anchor()).inside).toBe(true);
});

// Removing the inner controls must not make the official external control disappear on phones.
test('reader and admin retain one usable external theme control without duplicate menu controls',async({page})=>{
 for(const query of ['?reader=1','']){
  await mount(page,query);const menu=page.getByRole('menu');
  await expect(menu.getByRole('group',{name:'外观',exact:true})).toHaveCount(0);
  await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);
  const theme=page.locator('.account-controls>[data-theme-toggle]');await expect(theme).toBeVisible();
  await theme.click();await expect(page.locator('html')).toHaveClass(/dark/);
  await theme.click();await expect(page.locator('html')).toHaveClass(/light/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});
