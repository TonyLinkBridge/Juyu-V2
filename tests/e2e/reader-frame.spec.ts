import {pdfCSS} from '../../src/pdf/render';
import {test,expect} from '@playwright/test';
import {readerFrameBundle} from '../helpers/reader-frame-browser';
let bundle:Awaited<ReturnType<typeof readerFrameBundle>>;
test.beforeAll(async()=>{bundle=await readerFrameBundle();});
test('reader frame retains search and navigation when content changes; notices never move sidebar',async({page},info)=>{
 await page.route('**/reader-frame-fixture*',r=>r.fulfill({contentType:'text/html',body:'<html><body><div id="app"></div></body></html>'}));
 await page.goto('/reader-frame-fixture?q=example');await page.addStyleTag({content:bundle.css});await page.addScriptTag({content:bundle.script});
 const search=page.getByRole('textbox',{name:'测试搜索'}),side=page.locator('.knowledge-sidebar');
 await expect(search).toBeVisible();await search.fill('保留输入');const initial=await side.boundingBox();
 await page.getByRole('button',{name:'关闭公告'}).click();const after=await side.boundingBox();expect(after?.y).toBe(initial?.y);
 await page.getByRole('button',{name:'OPS Internal',exact:true}).click();await expect(page.getByRole('heading',{name:'OPS Internal'})).toBeVisible();
 await expect(search).toHaveValue('保留输入');await expect(page.locator('header')).toHaveCount(1);await expect(page.getByText('重复目录')).toHaveCount(0);
 await page.screenshot({path:'output/verification/reader-frame-'+info.project.name+'.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('article and PDF keep their own reading layout instead of gaining an extra sidebar',async({page})=>{
 await page.route('**/reader-frame-fixture*',r=>r.fulfill({contentType:'text/html',body:'<html><body><div id="app"></div></body></html>'}));
 for(const query of ['article=test','screen=pdf']){
  await page.goto('/reader-frame-fixture?'+query);await page.addScriptTag({content:bundle.script});
  await expect(page.getByRole('heading',{name:'首页'})).toBeVisible();
  await expect(page.locator('.knowledge-sidebar')).toHaveCount(query==='screen=pdf'?1:0);
  await expect(page.locator('header')).toHaveCount(1);
 }
});


test('R01 search uses one persistent sidebar with a usable result column',async({page},info)=>{
 await page.route('**/reader-frame-fixture*',r=>r.fulfill({contentType:'text/html',body:'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div></body></html>'}));
 await page.goto('/reader-frame-fixture?q=域名&searchFixture=1');await page.addStyleTag({content:bundle.css});await page.addScriptTag({content:bundle.script});
 await expect(page.locator('.knowledge-sidebar')).toHaveCount(1);await expect(page.locator('[data-gb-table-of-contents]')).toHaveCount(0);await expect(page.getByText('重复目录')).toHaveCount(0);await expect(page.locator('main')).toHaveCount(1);
 await expect(page.getByRole('link',{name:/域名转出流程/})).toBeVisible();const box=await page.locator('.search-main').boundingBox();expect(box!.width).toBeGreaterThan(info.project.name==='mobile'?300:600);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`output/verification/R01-search-${info.project.name}.png`,fullPage:true});
 await page.evaluate(()=>document.documentElement.dataset.theme='dark');await page.screenshot({path:`output/verification/R01-search-dark-${info.project.name}.png`,fullPage:true});
 await page.goto('/reader-frame-fixture?q=域名&searchFixture=1&failed=1');await page.addStyleTag({content:bundle.css});await page.addScriptTag({content:bundle.script});await expect(page.getByRole('alert')).toContainText('搜索暂时无法加载');await expect(page.getByRole('link',{name:/域名转出流程/})).toHaveCount(0);await expect(page.locator('.knowledge-sidebar')).toHaveCount(1);
});

test('R05 mobile header expands search and keeps theme and admin entry in account menu',async({page},info)=>{
 await page.route('**/reader-frame-fixture*',r=>r.fulfill({contentType:'text/html',body:'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div></body></html>'}));
 await page.goto('/reader-frame-fixture?headerFixture=1&q=test');await page.addStyleTag({content:bundle.css});await page.addScriptTag({content:bundle.script});
 const input=page.getByRole('textbox',{name:'搜索资料'}),toggle=page.getByRole('button',{name:'打开搜索'}),account=page.locator('.account-menu>summary');
 if(info.project.name==='mobile'){
  await expect(input).toBeHidden();await expect(toggle).toBeVisible();await expect(page.locator('.account-controls>.theme-toggler')).toBeHidden();await expect(page.locator('.account-controls>.admin-console-button')).toBeHidden();
  await toggle.click();await expect(input).toBeFocused();await input.fill('域名');const box=await input.boundingBox();expect(box!.width).toBeGreaterThan(180);await input.press('Escape');await expect(input).toBeHidden();await expect(toggle).toBeFocused();
  await page.keyboard.press('Control+k');await expect(input).toBeFocused();await account.click();await expect(input).toBeHidden();
  await expect(page.locator('.mobile-account-shortcut').getByRole('link',{name:'管理后台'})).toBeVisible();await page.locator('.mobile-account-appearance').getByLabel('深色',{exact:true}).check();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'output/verification/R05-mobile-menu.png'});await page.keyboard.press('Escape');await expect(account).toBeFocused();
  for(const width of [320,390,760]){await page.setViewportSize({width,height:844});await toggle.click();await expect(input).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`output/verification/R05-search-${width}.png`});await input.press('Escape');}
 }else{await expect(input).toBeVisible();await expect(toggle).toBeHidden();await expect(page.locator('.account-controls>.theme-toggler')).toBeVisible();await expect(page.locator('.account-controls>.admin-console-button')).toBeVisible();}
});

test('R08 Reference has one active admin navigation entry on desktop and mobile',async({page},info)=>{
 await page.route('**/reader-frame-fixture*',r=>r.fulfill({contentType:'text/html',body:'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div></body></html>'}));
 await page.goto('/reader-frame-fixture?adminFixture=1&kind=reference&view=list');await page.addStyleTag({content:bundle.css});await page.addScriptTag({content:bundle.script});if(info.project.name==='mobile')await page.locator('.admin-mobile-nav>summary').click();
 const nav=page.locator('nav[aria-label="后台导航"]:visible');await expect(nav.locator('[aria-current=page]')).toHaveCount(1);await expect(nav.getByRole('link',{name:'Reference 管理',exact:true})).toHaveAttribute('aria-current','page');await expect(nav.getByRole('link',{name:'Reference 管理',exact:true})).toHaveAttribute('href','/admin?kind=reference&view=list');
});


test('R21 PDF keeps shared account, search and navigation on screen and removes chrome for printing',async({page},info)=>{
 await page.route('**/reader-frame-fixture*',r=>r.fulfill({contentType:'text/html',body:'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div></body></html>'}));
 await page.goto('/reader-frame-fixture?screen=pdf');await page.addStyleTag({content:bundle.css});await page.addStyleTag({content:pdfCSS});await page.addScriptTag({content:bundle.script});
 await expect(page.locator('header')).toHaveCount(1);await expect(page.getByText('重复标题栏')).toHaveCount(0);await expect(page.getByText('重复目录')).toHaveCount(0);
 if(info.project.name==='mobile')await page.getByRole('button',{name:'打开搜索'}).click();
 await expect(page.getByRole('textbox',{name:'测试搜索'})).toBeVisible();
 await page.locator('.account-menu>summary').click();await expect(page.getByRole('button',{name:'退出登录',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'退出登录',exact:true})).toBeEnabled();await expect(page.getByRole('button',{name:'账号设置'})).toBeVisible();
 await page.locator(info.project.name==='mobile'?'.mobile-account-appearance':'.account-controls>.theme-toggler').getByLabel('深色',{exact:true}).check();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 if(info.project.name==='desktop')await page.locator('.account-menu>summary').click();
 await expect(page.getByRole('button',{name:'退出登录',exact:true})).not.toHaveCSS('background-color','rgb(255, 255, 255)');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`output/verification/R21-pdf-account-${info.project.name}.png`});
 await page.emulateMedia({media:'print'});await expect(page.locator('header')).toBeHidden();await expect(page.locator('.knowledge-sidebar')).toBeHidden();await expect(page.locator('.feature-announcements')).toBeHidden();await expect(page.locator('#main-content')).toBeVisible();await expect(page.locator('.knowledge-body')).toHaveCSS('display','block');
});
