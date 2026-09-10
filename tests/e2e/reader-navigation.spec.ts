import type {NavigationNode} from '../../src/reader/tree';
import {test,expect} from '@playwright/test';
import {navigationBrowserBundle} from '../helpers/navigation-browser';
let bundle:Awaited<ReturnType<typeof navigationBrowserBundle>>;
test.beforeAll(async()=>{bundle=await navigationBrowserBundle();});
const pages=Array.from({length:35},(_,i)=>({type:'document' as const,id:`page-${i}`,title:i===0?'开始使用资料库':i===1?'域名转出操作说明':i===2?'费用与退款规则':i===3?'这是一个很长的目录文章标题，用来确认小屏幕和大字号下文字不会被截断或撑破页面':`业务操作说明 ${i+1}`,href:`/help-centre?article=page-${i}`}));
async function fixture(page:import('@playwright/test').Page,items:NavigationNode[]=pages,error=false,body='这是目录交互测试正文。'){
 await page.route(url=>url.pathname==='/help-centre',route=>{
 const selected=new URL(route.request().url()).searchParams.get('article')??undefined;
 const found=pages.find(item=>item.id===selected);
 const article=found?{id:found.id,title:found.title,revision:1,body}:null;
 const data=JSON.stringify({pages:items,requested:selected,failed:error,article}).replace(/</g,'\\u003c');
 return route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${bundle.css}</style></head><body><header class="site-header"><span class="brand-name">JUYU</span><span>本地目录测试 · 示例内容</span></header><div id="reader"></div><script id="data" type="application/json">${data}</script><script>${bundle.script}</script></body></html>`});
 });
}
async function openDirectory(page:import('@playwright/test').Page) {
 if((page.viewportSize()?.width??1440)<1024&&!await page.getByRole('dialog',{name:'文章目录菜单'}).isVisible())await page.getByRole('button',{name:'打开文章目录'}).click();
}
test('authorized directory links select exactly one item after click, refresh and back',async({page},info)=>{
 await fixture(page);await page.goto('/help-centre?article=page-0');await openDirectory(page);
 const nav=page.getByRole('navigation',{name:'文章目录'});
 await expect(nav.locator('[aria-current="page"]')).toHaveText('开始使用资料库');
 await nav.getByRole('link',{name:'域名转出操作说明',exact:true}).click();await openDirectory(page);
 await expect(page.locator('#main-content h1')).toHaveText('域名转出操作说明');
 await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
 await page.reload();await openDirectory(page);await expect(nav.locator('[aria-current="page"]')).toHaveText('域名转出操作说明');
 await page.goBack();await openDirectory(page);await expect(nav.locator('[aria-current="page"]')).toHaveText('开始使用资料库');
 await nav.getByRole('link',{name:'域名转出操作说明',exact:true}).focus();await page.keyboard.press('Enter');await openDirectory(page);
 await expect(nav.locator('[aria-current="page"]')).toHaveText('域名转出操作说明');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBe(false);
 await page.screenshot({path:`output/verification/navigation-${info.project.name}.png`,fullPage:true});
});
test('long directory scrolls to its last link and an unauthorized target never becomes active',async({page})=>{
 await fixture(page);await page.goto('/help-centre?article=hidden');await openDirectory(page);
 const nav=page.getByRole('navigation',{name:'文章目录'});
 await expect(nav.locator('[aria-current]')).toHaveCount(0);
 await expect(page.locator('#main-content h1')).toHaveText('文章暂不可用');
 await expect(page.getByText('hidden',{exact:true})).toHaveCount(0);
 await nav.getByRole('link',{name:'业务操作说明 35',exact:true}).click();await openDirectory(page);
 await expect(nav.locator('[aria-current="page"]')).toHaveText('业务操作说明 35');
 await page.reload();await openDirectory(page);
 await expect.poll(()=>nav.locator('[aria-current="page"]').evaluate(element=>{
   const item=element.getBoundingClientRect();const container=element.closest('[data-testid="toc-scroll-container"]')!.getBoundingClientRect();
   return item.top>=container.top&&item.bottom<=container.bottom;
 })).toBe(true);
});
test('empty navigation and connection failure are distinguished without sample content',async({page})=>{
 await fixture(page,[]);await page.goto('/help-centre?fixture=empty');await openDirectory(page);
 await expect(page.getByRole('navigation').getByRole('link')).toHaveCount(0);
 await expect(page.locator('#main-content h1')).toHaveText('欢迎使用资料库');
 await expect(page.getByRole('navigation',{name:'文章目录'}).getByText('暂无可阅读的已发布文章')).toBeVisible();
 await page.unrouteAll();await fixture(page,[],true);await page.goto('/help-centre?fixture=error');await openDirectory(page);
 await expect(page.locator('#main-content h1')).toHaveText('目录暂时无法加载');
 await expect(page.locator('#main-content a.secondary-link')).toHaveAttribute('href','/help-centre');
 await expect(page.getByText('暂无可阅读的已发布文章')).toHaveCount(0);
});

const nested:NavigationNode[]=[{type:'group',id:'staff',title:'客服知识',descendants:[
 {type:'group',id:'domains',title:'域名操作',descendants:[
  {type:'group',id:'transfer',title:'域名转出',descendants:[pages[1],pages[2]]},pages[0]]}
]}, {type:'group',id:'reference',title:'Reference 速查',descendants:[pages[4]]}];

test('nested groups collapse accessibly and the current branch is visible on reload',async({page},info)=>{
 await fixture(page,nested);await page.goto('/help-centre?article=page-1');await openDirectory(page);
 const nav=page.getByRole('navigation',{name:'文章目录'});
 const group=nav.getByRole('button',{name:'域名操作',exact:true});
 await expect(group).toHaveAttribute('aria-expanded','true');
 await expect(nav.locator('[aria-current="page"]')).toHaveText('域名转出操作说明');
 await group.focus();await page.keyboard.press('Enter');
 await expect(group).toHaveAttribute('aria-expanded','false');
 await expect(nav.getByRole('link',{name:'域名转出操作说明',exact:true})).toHaveCount(0);
 await page.keyboard.press('Tab');await expect(nav.getByRole('button',{name:'Reference 速查',exact:true})).toBeFocused();
 await page.reload();await openDirectory(page);await expect(group).toHaveAttribute('aria-expanded','true');
 await expect(nav.getByRole('link',{name:'域名转出操作说明',exact:true})).toBeVisible();
 await nav.getByRole('button',{name:'域名转出',exact:true}).click();await openDirectory(page);
 await expect(nav.getByRole('link',{name:'开始使用资料库',exact:true})).toBeVisible();
 await nav.getByRole('button',{name:'域名转出',exact:true}).click();await openDirectory(page);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBe(false);
 await page.screenshot({path:`output/verification/groups-${info.project.name}.png`,fullPage:true});
});

test('group buttons control unique panels and nested document navigation retains selection',async({page})=>{
 await fixture(page,nested);await page.goto('/help-centre?fixture=groups');await openDirectory(page);
 const nav=page.getByRole('navigation',{name:'文章目录'});
 const controls=await nav.getByRole('button').evaluateAll(buttons=>buttons.map(button=>button.getAttribute('aria-controls')));
 expect(controls.every(Boolean)).toBe(true);expect(new Set(controls).size).toBe(controls.length);
 await nav.getByRole('link',{name:'费用与退款规则',exact:true}).click();await openDirectory(page);
 await expect(page.locator('#main-content h1')).toHaveText('费用与退款规则');
 await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
 await page.goBack();await openDirectory(page);await expect(nav.locator('[aria-current="page"]')).toHaveCount(0);
});

const readingBody=['# 转出前准备','核对域名状态与申请人资料。','- 检查申请资料','- 确认域名状态','## 操作步骤',...Array.from({length:12},()=> '这是一段仅用于阅读排版验收的示例文本。它不代表正式业务规则。'.repeat(5)),'## 操作步骤','3. 提交申请','4. 等待处理','# 注意事项','请以正式发布的内部规则为准。'].join('\n\n');

test('published body and outline share anchors, preserve deep links and do not execute markup',async({page},info)=>{
 await fixture(page,pages,false,readingBody+'\n\n<script>window.readerInjected=true</script>\n<img src="https://outside.example/private" onerror="alert(1)">');
 await page.goto('/help-centre?article=page-1');
 await expect(page.getByRole('heading',{level:1})).toHaveText('域名转出操作说明');
 const outline=page.getByRole('navigation',{name:'本页目录'});
 await expect(outline.getByRole('link',{name:'操作步骤',exact:true})).toHaveCount(2);
 await outline.getByRole('link',{name:'操作步骤',exact:true}).nth(1).click();
 await expect(page).toHaveURL(/#section-3$/);

 await expect.poll(()=>page.locator('#section-3').evaluate(element=>element.getBoundingClientRect().top>=0&&element.getBoundingClientRect().bottom<=window.innerHeight)).toBe(true);
 await expect(outline.locator('[aria-current="location"]')).toHaveAttribute('href','#section-3');
 await page.evaluate(()=>window.scrollTo(0,0));
 await expect(outline.locator('[aria-current="location"]')).toHaveAttribute('href','#section-1');
 await outline.getByRole('link',{name:'操作步骤',exact:true}).nth(1).click();
 await expect(outline.locator('[aria-current="location"]')).toHaveAttribute('href','#section-3');
 await page.reload();await expect.poll(()=>page.locator('#section-3').evaluate(element=>element.getBoundingClientRect().top>=0&&element.getBoundingClientRect().bottom<=window.innerHeight)).toBe(true);
 await expect(page.locator('.gitbook-document script,.gitbook-document img')).toHaveCount(0);
 expect(await page.evaluate(()=>Object.prototype.hasOwnProperty.call(window,'readerInjected'))).toBe(false);
 await page.goto('/help-centre?article=page-1');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBe(false);
 await page.screenshot({path:`output/verification/reading-${info.project.name}.png`});
});

test('plain and empty formal bodies do not fabricate an outline',async({page})=>{
 await fixture(page,pages,false,'没有标题的正式文本。\n下一行继续显示。');await page.goto('/help-centre?article=page-0');
 await expect(page.locator('.gitbook-document')).toContainText('没有标题的正式文本。');
 await expect(page.getByRole('navigation',{name:'本页目录'})).toHaveCount(0);
 await page.unrouteAll();await fixture(page,pages,false,'');await page.goto('/help-centre?article=page-0');
 await expect(page.getByText('这篇文章暂时没有正文。')).toBeVisible();
 await expect(page.getByRole('navigation',{name:'本页目录'})).toHaveCount(0);
});

test('outline follows manual scrolling to the end and back through a long section',async({page})=>{
 await fixture(page,pages,false,readingBody);await page.goto('/help-centre?article=page-1');
 const outline=page.getByRole('navigation',{name:'本页目录'});
 await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
 await expect(outline.locator('[aria-current="location"]')).toHaveAttribute('href','#section-4');
 await page.locator('#section-2').evaluate(element=>window.scrollTo(0,window.scrollY+element.getBoundingClientRect().top+200));
 await expect(outline.locator('[aria-current="location"]')).toHaveAttribute('href','#section-2');
});


test('mobile menu opens as a modal, closes with Escape and restores focus',async({page})=>{
 await page.setViewportSize({width:390,height:844});await fixture(page,nested);await page.goto('/help-centre?article=page-1');
 const trigger=page.getByRole('button',{name:'打开文章目录'});
 await expect(trigger).toBeVisible();await expect(page.getByRole('navigation',{name:'文章目录'})).toHaveCount(0);
 await trigger.click();const dialog=page.getByRole('dialog',{name:'文章目录菜单'});await expect(dialog).toBeVisible();
 const close=dialog.getByRole('button',{name:'关闭文章目录'});await expect(close).toBeFocused();
 await expect(dialog.getByRole('navigation',{name:'文章目录'}).locator('[aria-current="page"]')).toHaveText('域名转出操作说明');
 await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(trigger).toBeFocused();await expect(trigger).toHaveAttribute('aria-expanded','false');
});


test('mobile menu traps focus, allows group collapse and navigates with the drawer closed',async({page})=>{
 await page.setViewportSize({width:390,height:844});await fixture(page,nested);await page.goto('/help-centre?article=page-1');await openDirectory(page);
 const dialog=page.getByRole('dialog',{name:'文章目录菜单'});const close=dialog.getByRole('button',{name:'关闭文章目录'});
 await close.focus();await page.keyboard.press('Shift+Tab');await expect(dialog.getByRole('link',{name:'业务操作说明 5',exact:true})).toBeFocused();
 await page.keyboard.press('Tab');await expect(close).toBeFocused();
 const group=dialog.getByRole('button',{name:'域名转出',exact:true});await group.click();await expect(dialog.getByRole('link',{name:'费用与退款规则',exact:true})).toHaveCount(0);await group.click();
 await dialog.getByRole('link',{name:'费用与退款规则',exact:true}).click();await expect(page.getByRole('heading',{level:1})).toHaveText('费用与退款规则');await expect(dialog).not.toBeVisible();
 await openDirectory(page);await expect(dialog.locator('[aria-current="page"]')).toHaveText('费用与退款规则');
 await dialog.getByRole('button',{name:'关闭文章目录'}).click();await page.reload();await expect(dialog).not.toBeVisible();
});

test('mobile drawer keeps a long directory and its current article inside the viewport',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await fixture(page,pages,false,readingBody);await page.goto('/help-centre?article=page-34');
 await page.screenshot({path:`output/verification/mobile-menu-closed-${info.project.name}.png`});await openDirectory(page);
 const dialog=page.getByRole('dialog',{name:'文章目录菜单'});const active=dialog.locator('[aria-current="page"]');
 await expect.poll(()=>active.evaluate(element=>{const rect=element.getBoundingClientRect(),box=element.closest('[data-testid="toc-scroll-container"]')!.getBoundingClientRect();return rect.top>=box.top&&rect.bottom<=box.bottom;})).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBe(false);
 await page.screenshot({path:`output/verification/mobile-menu-open-${info.project.name}.png`});
 // Tapping the backdrop closes; the strip is outside the bounded dialog.
 await page.mouse.click(380,150);await expect(dialog).not.toBeVisible();await expect(page.getByRole('button',{name:'打开文章目录'})).toBeFocused();
});

test('closing a scrolled page restores scroll and resizing to desktop releases the modal',async({page})=>{
 await page.setViewportSize({width:390,height:844});await fixture(page,pages,false,readingBody);await page.goto('/help-centre?article=page-34');
 await page.evaluate(()=>window.scrollTo(0,500));
 // Keyboard shortcut is not required: programmatic activation avoids auto-scrolling
 // the off-screen trigger and lets this regression isolate scroll restoration.
 const trigger=page.getByRole('button',{name:'打开文章目录'});await trigger.evaluate(element=>(element as HTMLButtonElement).click());
 const dialog=page.getByRole('dialog',{name:'文章目录菜单'});await expect(dialog).toBeVisible();
 expect(await page.evaluate(()=>document.body.style.position)).toBe('fixed');
 await page.mouse.wheel(0,400);await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(500);
 await trigger.evaluate(element=>(element as HTMLButtonElement).click());await expect(dialog).toBeVisible();
 await page.setViewportSize({width:1440,height:1000});await expect(dialog).not.toBeVisible();
 // Native dialog close queues its close event after hiding the element.
 await expect.poll(()=>page.evaluate(()=>document.body.style.position)).toBe('');await expect(trigger).not.toBeVisible();
 const nav=page.getByRole('navigation',{name:'文章目录'});await expect(nav.locator('[aria-current="page"]')).toBeFocused();await expect(nav.locator('[aria-current="page"]')).toBeInViewport({ratio:1});
 await page.setViewportSize({width:390,height:844});await expect(trigger).toBeVisible();await expect(dialog).not.toBeVisible();await trigger.click();await expect(dialog).toBeVisible();
});

test('narrow landscape and wide table containers do not expand the reading page',async({page})=>{
 await page.setViewportSize({width:568,height:320});await fixture(page,pages,false,readingBody);await page.goto('/help-centre?article=page-1');await openDirectory(page);
 const dialog=page.getByRole('dialog',{name:'文章目录菜单'});await expect(dialog.getByRole('button',{name:'关闭文章目录'})).toBeInViewport();
 const nav=dialog.getByRole('navigation',{name:'文章目录'});await nav.getByRole('link',{name:'业务操作说明 35',exact:true}).click();await expect(dialog).not.toBeVisible();
 // Layout-only fixture: the real table renderer is still a future content task.
 await page.locator('.gitbook-document').evaluate(element=>{const region=document.createElement('div');region.className='reader-scroll-region';region.tabIndex=0;region.setAttribute('aria-label','表格排版测试');const table=document.createElement('table');table.style.minWidth='1200px';const row=table.insertRow();for(let i=0;i<12;i++)row.insertCell().textContent='示例表格列 '+i;region.append(table);element.append(region);});
 const region=page.getByLabel('表格排版测试');expect(await region.evaluate(element=>element.scrollWidth>element.clientWidth)).toBe(true);
 await region.evaluate(element=>{element.scrollLeft=300;});expect(await region.evaluate(element=>element.scrollLeft)).toBeGreaterThan(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBe(false);
});


test('unsupported modal browsers retain a working details fallback without runtime errors',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>{Object.defineProperty(HTMLDialogElement.prototype,'showModal',{value:undefined,configurable:true});Object.defineProperty(HTMLDialogElement.prototype,'close',{value:undefined,configurable:true});});
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await fixture(page,nested);await page.goto('/help-centre?article=page-1');
 await expect(page.locator('.mobile-navigation-fallback > summary')).toBeVisible();expect(errors).toEqual([]);
 await page.locator('.mobile-navigation-fallback > summary').click();await page.getByRole('navigation',{name:'文章目录'}).getByRole('link',{name:'费用与退款规则',exact:true}).click();await expect(page.getByRole('heading',{level:1})).toHaveText('费用与退款规则');expect(errors).toEqual([]);
});


test('mobile-first reader reveals its current deep directory item after switching to desktop',async({page})=>{
 await page.setViewportSize({width:390,height:844});await fixture(page);await page.goto('/help-centre?article=page-34');
 await expect(page.getByRole('button',{name:'打开文章目录'})).toBeVisible();await page.setViewportSize({width:1440,height:1000});
  await expect(page.getByRole('navigation',{name:'文章目录'}).locator('[aria-current="page"]')).toBeInViewport({ratio:1});
});


test('breadcrumb hierarchy and page cards follow the visible directory with native history',async({page},info)=>{
 await fixture(page,nested);await page.goto('/help-centre?article=page-2');
 const crumbs=page.getByRole('navigation',{name:'面包屑'});
 await expect(crumbs.locator('li')).toHaveText(['帮助中心›','客服知识›','域名操作›','域名转出›','费用与退款规则']);
 await expect(crumbs.locator('[aria-current="page"]')).toHaveText('费用与退款规则');
 const cards=page.getByRole('navigation',{name:'文章翻页'});
 await expect(cards.getByRole('link',{name:'上一篇：域名转出操作说明'})).toHaveAttribute('href','/help-centre?article=page-1');
 await expect(cards.getByRole('link',{name:'下一篇：开始使用资料库'})).toHaveAttribute('href','/help-centre?article=page-0');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBe(false);
 await page.screenshot({path:`output/verification/page-links-${info.project.name}.png`,fullPage:true});
 await cards.getByRole('link',{name:'下一篇：开始使用资料库'}).focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('heading',{level:1})).toHaveText('开始使用资料库');
 await page.reload();await expect(cards.getByRole('link',{name:'下一篇：业务操作说明 5'})).toBeVisible();
 await page.goBack();await expect(page.getByRole('heading',{level:1})).toHaveText('费用与退款规则');
 await crumbs.getByRole('link',{name:'帮助中心'}).click();await expect(page.getByRole('heading',{level:1})).toHaveText('欢迎使用资料库');await expect(cards).toHaveCount(0);
});

test('single, first, last and unavailable articles expose only usable page navigation',async({page})=>{
 await fixture(page,[pages[0]]);await page.goto('/help-centre?article=page-0');
 await expect(page.getByRole('navigation',{name:'文章翻页'})).toHaveCount(0);await expect(page.getByRole('navigation',{name:'面包屑'}).locator('li')).toHaveCount(2);
 await page.unrouteAll();await fixture(page,[pages[0],pages[1]]);await page.goto('/help-centre?article=page-0');
 const cards=page.getByRole('navigation',{name:'文章翻页'});await expect(cards.getByRole('link')).toHaveCount(1);await expect(cards.getByRole('link')).toHaveAttribute('rel','next');
 await cards.getByRole('link').click();await expect(cards.getByRole('link')).toHaveCount(1);await expect(cards.getByRole('link')).toHaveAttribute('rel','prev');
 await page.goto('/help-centre?article=unreadable');await expect(cards).toHaveCount(0);await expect(page.getByRole('navigation',{name:'面包屑'})).toHaveCount(0);await expect(page.getByRole('button',{name:'回到顶部'})).toHaveCount(0);
});

test('back to top scrolls fully and returns keyboard focus while retaining the article deep link',async({page})=>{
 await fixture(page,pages,false,readingBody);await page.goto('/help-centre?article=page-1#section-3');
 const button=page.getByRole('button',{name:'回到顶部'});
 await button.focus();await page.keyboard.press('Enter');
 await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(0);await expect(page.getByRole('heading',{level:1})).toBeFocused();await expect(page).toHaveURL(/article=page-1#section-3$/);
 await page.emulateMedia({reducedMotion:'reduce'});await button.focus();await page.keyboard.press('Enter');
 await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(0);await expect(page.getByRole('heading',{level:1})).toBeFocused();
});
