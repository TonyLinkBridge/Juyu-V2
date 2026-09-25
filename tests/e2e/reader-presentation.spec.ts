import {test,expect} from '@playwright/test';
import {searchTitles} from '../../src/reader/search';

test('theme choices remember explicit preferences and follow system changes',async({page})=>{
 await readerFixture(page);await page.emulateMedia({colorScheme:'light'});await page.goto('/help-centre');
 const choices=page.getByRole('group',{name:'外观主题'});
 await expect(choices.getByRole('radio',{name:'跟随系统'})).toBeChecked();
 await choices.getByRole('radio',{name:'深色',exact:true}).check();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.reload();await expect(choices.getByRole('radio',{name:'深色',exact:true})).toBeChecked();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await choices.getByRole('radio',{name:'浅色',exact:true}).check();
 await page.emulateMedia({colorScheme:'dark'});await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await choices.getByRole('radio',{name:'跟随系统'}).check();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.emulateMedia({colorScheme:'light'});await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await choices.getByRole('radio',{name:'浅色',exact:true}).focus();await page.keyboard.press('ArrowRight');await expect(choices.getByRole('radio',{name:'跟随系统'})).toBeChecked();
});

test('blocked storage still allows switching without crashing',async({page})=>{
 await page.addInitScript(()=>{Storage.prototype.getItem=()=>{throw new Error('blocked')};Storage.prototype.setItem=()=>{throw new Error('blocked')};});
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await readerFixture(page);await page.emulateMedia({colorScheme:'dark'});await page.goto('/help-centre');
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.getByRole('radio',{name:'浅色',exact:true}).check();await expect(page.locator('html')).toHaveAttribute('data-theme','light');expect(errors).toEqual([]);
});

test('theme syncs between tabs and internal announcements are absent before login',async({page,context})=>{
 await readerFixture(page);await page.goto('/help-centre');const second=await context.newPage();await readerFixture(second);await second.goto('/help-centre');
 await page.getByRole('radio',{name:'深色',exact:true}).check();await expect(second.locator('html')).toHaveAttribute('data-theme','dark');
 await page.unrouteAll();await second.unrouteAll();await page.goto('/sign-in');await second.goto('/admin/sign-in');
 await expect(page.getByRole('region',{name:'资料库公告'})).toHaveCount(0);await expect(second.getByRole('region',{name:'资料库公告'})).toHaveCount(0);
 await second.close();
});

import {navigationBrowserBundle} from '../helpers/navigation-browser';
let bundle:Awaited<ReturnType<typeof navigationBrowserBundle>>;
test.beforeAll(async()=>{bundle=await navigationBrowserBundle();});
async function readerFixture(page:import('@playwright/test').Page,revision='1',message='本地公告验收 · 内部资料仅供团队使用。'){
 await page.route(url=>url.pathname==='/help-centre',route=>{
 const pages=Array.from({length:35},(_,i)=>({type:'document' as const,id:`p-${i}`,title:`本地示例文章 ${i+1}`,href:`/help-centre?article=p-${i}`}));
 const query=new URL(route.request().url()).searchParams.get('q');
 const search=query===null?undefined:searchTitles(pages,query,undefined);
 const data=JSON.stringify({pages,search,requested:'p-34',article:{id:'p-34',title:'本地示例文章 35',revision:1,body:'# 阅读说明\n\n仅用于本地外观验收，不代表正式业务规则。\n\n## 操作步骤\n\n请以已发布的资料为准。'},announcement:{id:'test-notice',revision,message}});
 return route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.css}</style></head><body><div id="presentation"></div><script id="data" type="application/json">${data}</script><script>${bundle.script}</script></body></html>`});
 });
}
test('announcement dismissal survives reload and a new revision appears again',async({page})=>{
 await readerFixture(page);await page.goto('/help-centre');const notice=page.getByRole('region',{name:'资料库公告'});
 await expect(notice).toContainText('本地公告验收');await expect(page.locator('#presentation')).not.toHaveAttribute('data-hydration-error');await notice.getByRole('button',{name:'关闭公告'}).click();await expect(notice).toHaveCount(0);await expect(page.locator('#main-content')).toBeFocused();
 await page.reload();await expect(page.getByRole('heading',{level:1})).toBeVisible();await expect(notice).toHaveCount(0);
 await page.unrouteAll();await readerFixture(page,'2');await page.reload();await expect(notice).toBeVisible();
});

test('dark reader, long directory, mobile menu and footer stay readable without overflow',async({page},info)=>{
 await readerFixture(page);await page.goto('/help-centre');await page.getByRole('radio',{name:'深色',exact:true}).check();await page.evaluate(()=>window.scrollTo(0,0));
 await expect(page.locator('#presentation')).not.toHaveAttribute('data-hydration-error');await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await expect(page.getByRole('region',{name:'资料库公告'})).toBeVisible();
 const trigger=page.getByRole('button',{name:'打开文章目录'});
 if(info.project.name==='mobile')await trigger.click();
 await expect(page.getByRole('navigation',{name:'文章目录'}).locator('[aria-current="page"]')).toBeInViewport({ratio:1});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 await page.screenshot({path:`output/verification/theme-dark-${info.project.name}.png`,fullPage:info.project.name==='desktop'});
 if(info.project.name==='mobile')await page.keyboard.press('Escape');
 await page.getByRole('radio',{name:'浅色',exact:true}).check();await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:`output/verification/theme-light-${info.project.name}.png`,fullPage:true});
});

test('stored theme is applied before app hydration and corrupt storage uses system',async({page})=>{
 await page.addInitScript(()=>{if(localStorage.getItem('juyu.theme.v1')===null)localStorage.setItem('juyu.theme.v1','dark');});
 await page.route('**/_next/**/*.js',route=>route.abort());await page.emulateMedia({colorScheme:'light'});await page.goto('/sign-in');
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 expect(await page.locator('html').evaluate(el=>getComputedStyle(el).colorScheme)).toBe('dark');
 await page.evaluate(()=>localStorage.setItem('juyu.theme.v1','invalid-value'));await page.reload();
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');await expect(page.locator('html')).toHaveAttribute('data-theme-mode','system');
});

test('announcement still closes with blocked storage and wrapping does not clip the directory',async({page})=>{
 await page.setViewportSize({width:1100,height:700});
 await page.addInitScript(()=>{Storage.prototype.getItem=()=>{throw new Error('blocked')};Storage.prototype.setItem=()=>{throw new Error('blocked')};});
 await readerFixture(page,'1','这是一段用于确认多行公告的本地示例。'.repeat(8));await page.goto('/help-centre');
 const active=page.getByRole('navigation',{name:'文章目录'}).locator('[aria-current="page"]');await expect(active).toBeInViewport({ratio:1});
 await page.getByRole('button',{name:'关闭公告'}).click();await expect(page.getByRole('region',{name:'资料库公告'})).toHaveCount(0);await expect(page.locator('#main-content')).toBeFocused();
 await expect(active).toBeInViewport({ratio:1});
});

async function textContrast(page:import('@playwright/test').Page,selectors:string[]){
 for(const selector of selectors){
  const ratios=await page.locator(selector).evaluateAll(elements=>elements.filter(el=>el.getClientRects().length).map(el=>{
   const rgb=(value:string)=>{const parts=value.match(/[\d.]+/g)!.map(Number);return parts;};
   const luminance=(channels:number[])=>channels.slice(0,3).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
   let bg=[255,255,255];let node:Element|null=el;
   while(node){const color=rgb(getComputedStyle(node).backgroundColor);if(color.length===3||color[3]===1){bg=color;break;}node=node.parentElement;}
   const foreground=luminance(rgb(getComputedStyle(el).color)),background=luminance(bg);
   return (Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05);
  }));
  expect(ratios.length,selector).toBeGreaterThan(0);for(const ratio of ratios)expect(ratio,selector).toBeGreaterThanOrEqual(4.5);
 }
}

test('both palettes keep reader, search highlights and entry text at readable contrast',async({page},info)=>{
 await readerFixture(page);await page.goto('/help-centre');
 for(const mode of ['浅色','深色']){
  await page.getByRole('radio',{name:mode,exact:true}).check();
  await textContrast(page,['.reader-test-meta','.gitbook-document .paragraph','.reader-announcement p','.footer-copy span','.theme-toggler span']);
 }
 await page.goto('/help-centre?q='+encodeURIComponent('示例'));
 await expect(page.getByRole('list',{name:'搜索结果列表'})).toBeVisible();
 for(const mode of ['浅色','深色']){
  await page.getByRole('radio',{name:mode,exact:true}).check();
  await textContrast(page,['.search-match','.search-summary','.search-result-content h2','.search-submit']);
 }
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`output/verification/theme-search-dark-${info.project.name}.png`});
 await page.unrouteAll();await page.goto('/sign-in');
 await textContrast(page,['.login-screen h1','.login-description','.login-policy']);
 await page.screenshot({path:`output/verification/theme-login-dark-${info.project.name}.png`,fullPage:true});
 await page.goto('/admin/sign-in');
 await textContrast(page,['.login-screen h1','.login-description','.login-policy']);
});
