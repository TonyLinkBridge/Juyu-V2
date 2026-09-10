import {test,expect} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import type {AxeResults} from 'axe-core';
import {secondarySurfaces,mountSecondary} from '../helpers/accessibility-secondary';
for(const surface of secondarySurfaces)test(`${surface.name} secondary UI audit`,async({page},info)=>{
 test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});await mountSecondary(page,surface);
 await expect(page.getByRole('heading',{level:1}).first()).toBeVisible();
 await page.addScriptTag({content:await readFile('node_modules/axe-core/axe.min.js','utf8')});
 for(const theme of ['light','dark']){
  await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
  await expect(page.locator('body')).toHaveCSS('color',theme==='light'?'rgb(34, 36, 42)':'rgb(238, 237, 241)');
  const result=await page.evaluate(async()=>await (window as unknown as {axe:{run(o:unknown):Promise<AxeResults>}}).axe.run({runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}));
  const dir='output/verification/T057-secondary';await mkdir(dir,{recursive:true});
  await writeFile(`${dir}/${surface.name}-${theme}-${info.project.name}.json`,JSON.stringify({surface:surface.name,theme,project:info.project.name,at:new Date().toISOString(),...result},null,2));
  await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`${dir}/${surface.name}-${theme}-${info.project.name}.png`,fullPage:true,animations:'disabled'});
  await page.screenshot({path:`${dir}/${surface.name}-${theme}-${info.project.name}-viewport.png`,animations:'disabled'});
  expect.soft(result.incomplete.filter(v=>v.id==='aria-prohibited-attr')).toEqual([]);
  expect.soft(result.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))).toEqual([]);
  expect.soft(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page has no horizontal overflow').toBe(true);
 }
 expect(errors).toEqual([]);
});

test('secondary keyboard flows remain usable at 320 pixels',async({page})=>{
 test.setTimeout(90000);await page.setViewportSize({width:320,height:844});
 await mountSecondary(page,secondarySurfaces.find(s=>s.name==='qa')!);
 const category=page.getByRole('link',{name:'查看分类：账户操作'});await category.focus();await expect(category).toBeFocused();expect((await category.boundingBox())!.height).toBeGreaterThanOrEqual(44);
 await page.route('**/help-centre/qa?*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:'<h1>本地分类目标</h1>'}));await page.keyboard.press('Enter');await expect(page).toHaveURL(/category=/);await expect(page.getByRole('heading',{name:'本地分类目标'})).toBeVisible();
 await page.unrouteAll();await mountSecondary(page,secondarySurfaces.find(s=>s.name==='rich-blocks')!);
 const code=page.getByRole('region',{name:'代码内容，可横向滚动'});await code.focus();await expect(code).toBeFocused();await page.keyboard.press('Tab');expect(await code.evaluate(e=>e===document.activeElement)).toBe(false);
 const tab=page.getByRole('tab',{name:'注册',exact:true});await tab.focus();await page.keyboard.press('ArrowRight');await expect(page.getByRole('tab',{name:'转入',exact:true})).toBeFocused();await expect(page.getByRole('tabpanel',{name:'转入',exact:true})).toBeVisible();
 await page.unrouteAll();await mountSecondary(page,secondarySurfaces.find(s=>s.name==='science')!);const formula=page.getByRole('group',{name:'数学公式',exact:true});await formula.focus();await expect(formula).toBeFocused();await expect(formula.locator('math')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('history loading announces progress and failed refresh preserves displayed records',async({page},info)=>{
 test.setTimeout(90000);await mountSecondary(page,secondarySurfaces.find(s=>s.name==='setting-history')!);
 let release!:()=>void;const held=new Promise<void>(resolve=>release=resolve);
 await page.route('**/api/admin/settings/history?**',async r=>{await held;await r.fulfill({status:503,json:{error:'LOCAL_UNAVAILABLE'}});});
 const refresh=page.getByRole('button',{name:'刷新历史列表'});await expect(refresh).toBeEnabled();await refresh.focus();await expect(refresh).toBeFocused();const request=page.waitForRequest(r=>r.url().includes('/api/admin/settings/history?'));await page.keyboard.press('Enter');await request;
 try{
  await expect(page.getByRole('status')).toContainText('正在处理');await expect(page.getByRole('button',{name:'刷新历史列表'})).toBeDisabled();
  await expect(page.getByLabel('设置类型',{exact:true})).toBeDisabled();
  await page.screenshot({path:`output/verification/T057-secondary/history-loading-${info.project.name}.png`,fullPage:true});
 }finally{release();}
 await expect(page.getByRole('alert')).toContainText('已有记录未改变');await expect(page.getByRole('button',{name:'刷新历史列表'})).toBeEnabled();await expect(page.getByRole('button',{name:'查看 功能开关 版本 1'})).toBeVisible();
});
