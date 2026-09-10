import {test,expect} from '@playwright/test';
import {workspaceHTML} from '../helpers/workspace-browser';
async function fixture(page:import('@playwright/test').Page,options:{empty?:boolean;failed?:boolean}={}){
 await page.route(url=>url.pathname==='/admin',async route=>route.fulfill({contentType:'text/html',body:await workspaceHTML(route.request().url(),options)}));
 await page.goto('/admin');
}
test('workspace renders real-count contract and responsive list with safe titles',async({page},info)=>{
 await fixture(page);await expect(page.getByRole('heading',{name:'内容管理',exact:true})).toBeVisible();
 await expect(page.getByRole('status')).toContainText('共 36 篇');
 await page.locator('.tasks-tools-disclosure summary').click();
 await expect(page.getByRole('link',{name:'使用分析',exact:true})).toHaveAttribute('href','/admin/analytics');
 await page.locator('.tasks-tools-disclosure summary').click();
 await expect(page.getByRole('navigation',{name:'按状态查看'}).getByRole('link')).toHaveCount(6);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const visible=info.project.name==='mobile'?page.locator('.tasks-mobile-list'):page.locator('.tasks-desktop-board');
 await expect(visible.getByRole('link',{name:'中文标题 <script> 不执行',exact:true})).toBeVisible();
 await expect(visible.getByText('旧正式版 1 仍可阅读').first()).toBeVisible();
 if(info.project.name==='mobile')await expect(page.getByText('手机列表',{exact:true})).toBeVisible();
 else{await page.getByRole('link',{name:'列表',exact:true}).click();await expect(page.locator('.tasks-all-list')).toBeVisible();await page.reload();await expect(page.locator('.tasks-all-list')).toBeVisible();await page.getByRole('link',{name:'看板',exact:true}).click();}
 await page.screenshot({path:`output/verification/workspace-${info.project.name}.png`,fullPage:false});
 await page.evaluate(()=>document.documentElement.dataset.theme='dark');await page.screenshot({path:`output/verification/workspace-dark-${info.project.name}.png`,fullPage:false});
 if(info.project.name==='mobile'){await page.locator('.tasks-mobile-list').scrollIntoViewIfNeeded();await page.screenshot({path:'output/verification/workspace-mobile-content.png',fullPage:false});}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const contrasts=await page.locator('.task-status-filters strong').evaluateAll(nodes=>nodes.map(node=>{
  const luminance=(rgb:string)=>{const values=rgb.match(/[\d.]+/g)!.slice(0,3).map(Number).map(x=>{x/=255;return x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4;});return values[0]*0.2126+values[1]*0.7152+values[2]*0.0722;};
  const foreground=luminance(getComputedStyle(node).color),background=luminance(getComputedStyle(node.parentElement!).backgroundColor);
  return (Math.max(foreground,background)+0.05)/(Math.min(foreground,background)+0.05);
 }));expect(Math.min(...contrasts)).toBeGreaterThanOrEqual(4.5);
});
test('workspace filters by personal scope, kind and status and resets page via keyboard',async({page})=>{
 await fixture(page);await page.getByRole('link',{name:'下一页',exact:true}).click();await expect(page.getByRole('status')).toContainText('第 2 / 2 页');
 await page.getByLabel('与我有关').selectOption('returned');await page.getByRole('button',{name:'应用筛选'}).focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('status')).toContainText('共 6 篇 · 第 1 / 1 页');await expect(page.getByLabel('与我有关')).toHaveValue('returned');
 await page.reload();await expect(page.getByLabel('与我有关')).toHaveValue('returned');
 await page.getByLabel('与我有关').selectOption('review');await page.getByRole('button',{name:'应用筛选'}).click();await expect(page.getByRole('heading',{name:'没有符合条件的内容'})).toBeVisible();
 await page.getByRole('link',{name:'清除筛选'}).click();await page.getByLabel('资料类型').selectOption('ops');await page.getByRole('button',{name:'应用筛选'}).click();await expect(page.getByRole('status')).toContainText('共 12 篇');
 await page.getByRole('navigation',{name:'按状态查看'}).getByRole('link',{name:/^草稿\s*6$/}).click();await expect(page.getByRole('status')).toContainText('共 6 篇');
 await page.getByLabel('搜索标题').fill('no-match');await page.getByRole('button',{name:'应用筛选'}).click();await expect(page.getByRole('heading',{name:'没有符合条件的内容'})).toBeVisible();
});
test('workspace service failure is distinct from empty and retry recovers',async({page})=>{
 await fixture(page,{failed:true});await expect(page.getByRole('heading',{name:'内容暂时无法读取'})).toBeVisible();await expect(page.getByText(/共 0 篇/)).toHaveCount(0);
 await page.unrouteAll();await page.route(url=>url.pathname==='/admin',async route=>route.fulfill({contentType:'text/html',body:await workspaceHTML(route.request().url(),{empty:true})}));
 await page.getByRole('link',{name:'重新读取内容'}).click();await expect(page.getByRole('heading',{name:'没有符合条件的内容'})).toBeVisible();await expect(page.getByRole('status')).toContainText('共 0 篇');
});
test('real workspace endpoint and admin page reject missing or forged identities',async({request,page})=>{
 const r=await request.get('/api/admin/workspace?scope=review&role=admin&actorId=a',{headers:{'x-role':'admin','x-user-id':'a'}});expect(r.status()).toBe(503);expect(r.headers()['cache-control']).toBe('private, no-store');expect(await r.text()).not.toContain('items');
 const post=await request.post('/api/admin/workspace',{data:{status:'published'}});expect(post.status()).toBe(405);
 await page.goto('/admin?scope=review');await expect(page.getByRole('heading',{name:'内容管理',exact:true})).toHaveCount(0);
});
