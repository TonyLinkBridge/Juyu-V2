import {test,expect} from '@playwright/test';
import {workspaceHTML} from '../helpers/workspace-browser';

test('type select keeps all types, keyboard operation and existing query context',async({page},info)=>{
 await page.route(url=>url.pathname==='/admin',async route=>route.fulfill({contentType:'text/html',body:await workspaceHTML(route.request().url())}));
 await page.goto('/admin?q=资料&scope=submitted&view=list&status=published');
 const select=page.getByRole('combobox',{name:'资料类型'});
 await select.click();await expect(page.getByRole('option')).toHaveCount(5);
 await expect(page.getByRole('option',{name:'Q&A',exact:true})).toBeVisible();
 await page.keyboard.press('Escape');await expect(select).toBeFocused();
 await select.press('ArrowDown');await page.getByRole('option',{name:'OPS Internal',exact:true}).click();
 await expect(page).toHaveURL(/kind=ops/);
 expect(Object.fromEntries(new URL(page.url()).searchParams)).toMatchObject({q:'资料',scope:'submitted',view:'list',status:'published',page:'1'});
 expect(await page.locator('form.tasks-filters').evaluate(form=>new FormData(form as HTMLFormElement).get('kind'))).toBe('ops');
 await select.click();
 const panel=page.getByRole('listbox');
 await expect(panel).toHaveCSS('animation-duration','0.15s');
 const light=await panel.evaluate(async node=>{await Promise.all(node.getAnimations().map(animation=>animation.finished));return getComputedStyle(node).backgroundColor;});
 expect(light).not.toBe('rgba(0, 0, 0, 0)');
 await page.screenshot({path:`output/verification/workspace-type-select-${info.project.name}.png`,fullPage:false});
 await page.evaluate(()=>document.documentElement.classList.add('dark'));
 expect(await panel.evaluate(node=>getComputedStyle(node).backgroundColor)).not.toBe(light);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`output/verification/workspace-type-select-dark-${info.project.name}.png`,fullPage:false});
});

test('status opens directly with light motion and announces pending while blocking duplicate requests',async({page})=>{
 await page.route(url=>url.pathname==='/admin',async route=>route.fulfill({contentType:'text/html',body:await workspaceHTML(route.request().url())}));
 await page.goto('/admin?view=list');
 await page.evaluate(()=>{
  const w=window as typeof window&{__workspaceNavigate?:(path:string)=>Promise<void>;__filterRequests?:number;__finishFilter?:()=>void};
  w.__filterRequests=0;w.__workspaceNavigate=path=>new Promise(resolve=>{w.__filterRequests!++;w.__finishFilter=()=>{resolve();location.assign(path);};});
 });
 await page.getByRole('button',{name:'添加筛选',exact:true}).click();
 await expect(page.getByRole('menuitemradio')).toHaveCount(7);
 await expect(page.getByRole('button',{name:'返回筛选项目'})).toHaveCount(0);
 const dialog=page.getByRole('dialog',{name:'内容状态',exact:true});
 await expect(dialog).toBeVisible();
 expect(await dialog.evaluate(node=>getComputedStyle(node).filter)).toBe('none');
 expect(await dialog.evaluate(node=>getComputedStyle(node.parentElement!).animationDuration)).toBe('0.15s');
 await page.getByRole('menuitemradio',{name:'草稿',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'正在筛选'})).toBeVisible();
 await expect(page.getByRole('button',{name:'正在筛选…',exact:true})).toBeDisabled();
 await expect(page.getByRole('combobox',{name:'资料类型'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'添加筛选',exact:true})).toBeDisabled();
 await page.locator('form.tasks-filters').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(await page.evaluate(()=>(window as typeof window&{__filterRequests:number}).__filterRequests)).toBe(1);
 await page.evaluate(()=>(window as typeof window&{__finishFilter:()=>void}).__finishFilter());
 await expect(page).toHaveURL(/status=draft/);
 await expect(page.locator('.tasks-results [role=status]')).toContainText('共 6 篇');
 await expect(page.getByRole('button',{name:'应用筛选',exact:true})).toBeEnabled();
});

test('search submits once and unchanged filters stay usable with reduced motion',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.route(url=>url.pathname==='/admin',async route=>route.fulfill({contentType:'text/html',body:await workspaceHTML(route.request().url())}));
 await page.goto('/admin?view=list');
 await page.getByRole('button',{name:'应用筛选',exact:true}).click();
 await expect(page.getByRole('button',{name:'应用筛选',exact:true})).toBeEnabled();
 await page.getByLabel('搜索标题').fill('no-match');await page.getByLabel('搜索标题').press('Enter');
 await expect(page).toHaveURL(/q=no-match/);
 await expect(page.getByRole('heading',{name:'没有符合条件的内容'})).toBeVisible();
 await page.getByRole('button',{name:'添加筛选',exact:true}).press('ArrowDown');
 await expect(page.getByRole('menuitemradio',{name:'全部状态',exact:true})).toBeFocused();
 await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'添加筛选',exact:true})).toBeFocused();
});

test('compact status menu fits above or below a trigger near the viewport edge',async({page})=>{
 await page.setViewportSize({width:1440,height:600});
 await page.route(url=>url.pathname==='/admin',async route=>route.fulfill({contentType:'text/html',body:await workspaceHTML(route.request().url())}));
 await page.goto('/admin?view=list');
 // Isolated fixture places the real control at the boundary between up/down room.
 await page.locator('[data-presentation=compact]').evaluate(node=>{(node as HTMLElement).style.cssText='position:fixed;top:280px;right:24px;';});
 await page.getByRole('button',{name:'添加筛选',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'内容状态',exact:true});
 const box=await dialog.evaluate(async node=>{await Promise.all(node.parentElement!.getAnimations().map(a=>a.finished));const r=node.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:innerHeight};});
 expect(box.top).toBeGreaterThanOrEqual(16);expect(box.bottom).toBeLessThanOrEqual(box.height-16);
 await page.getByRole('menuitemradio',{name:'已经发布',exact:true}).click();
 await expect(page).toHaveURL(/status=published/);
});
