import {test,expect,type Page} from '@playwright/test';
import {navigationBrowserBundle} from '../helpers/navigation-browser';
import {searchTitles,searchHref,type TitleSearch} from '../../src/reader/search';
import type {NavigationNode} from '../../src/reader/tree';
let bundle:Awaited<ReturnType<typeof navigationBrowserBundle>>;
test.beforeAll(async()=>{bundle=await navigationBrowserBundle();});
const articles=Array.from({length:45},(_,i)=>({type:'document' as const,id:`search-${i}`,title:i===0?'域名转出 EPP 操作说明':i===1?'域名转出进度查询':`域名转出操作说明 ${i+1}`,href:`/help-centre?article=search-${i}`}));
const pages:NavigationNode[]=[{type:'group',id:'domain',title:'域名操作',descendants:articles}];
async function fixture(page:Page,options:{failed?:boolean;unsafe?:boolean;wait?:()=>Promise<void>;serverSearch?:TitleSearch}={}){
 await page.route('**/help-centre?**',async route=>{
   await options.wait?.();
   const params=new URL(route.request().url()).searchParams;
   const get=(key:string)=>params.getAll(key).length>1?params.getAll(key):params.get(key)??undefined;
   const selected=get('article');const article=articles.find(item=>item.id===selected);
   const fixturePages:NavigationNode[]=options.unsafe?[{type:'group',id:'domain',title:'域名操作',descendants:articles.map((item,index)=>index===1?{...item,title:'域名转出 <script>window.searchInjected=true</script> 说明'}:item)}]:pages;
   const search=params.has('q')?(options.serverSearch??searchTitles(options.failed?[]:fixturePages,get('q'),get('page'))):undefined;
   const data=JSON.stringify({pages:options.failed?[]:fixturePages,requested:selected,article:article?{...article,revision:1,body:'本地搜索测试正文。'}:null,search,failed:options.failed??false,retryHref:searchHref(search?.query??'',search?.page)}).replace(/</g,'\\u003c');
   return route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${bundle.css}</style></head><body><header class="site-header has-search"><span class="brand-name">JUYU</span><span>本地搜索测试 · 示例资料</span><div id="search-input" style="display:contents"></div></header><div id="reader"></div><script id="data" type="application/json">${data}</script><script>${bundle.script}</script></body></html>`});
 });
}

test('search submits Chinese with Enter, highlights and opens a real reader link using keyboard',async({page},info)=>{
 await fixture(page);await page.goto('/help-centre?q=');
 const input=page.getByRole('textbox',{name:'搜索资料'});
 await input.fill('域名 EPP');await input.press('Enter');
 await expect(page.getByRole('status')).toHaveText('“域名 EPP” · 找到 1 项结果');
 const list=page.getByRole('list',{name:'搜索结果列表'});
 await expect(list.locator('.search-match')).toHaveText(['域名','EPP']);
 await expect(list).toContainText('知识文章 › 域名操作');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBe(false);
 await page.screenshot({path:`output/verification/search-${info.project.name}.png`});
 const link=list.getByRole('link');await link.focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('heading',{level:1})).toHaveText('域名转出 EPP 操作说明');
 await page.goBack();await expect(input).toHaveValue('域名 EPP');await page.reload();await expect(list.getByRole('link')).toHaveCount(1);
});

test('empty, zero, invalid and literal markup states remain distinct and safe',async({page})=>{
 await fixture(page);await page.goto('/help-centre?q=');await expect(page.getByText('输入关键词，开始查找')).toBeVisible();
 const input=page.getByRole('textbox',{name:'搜索资料'});
 await input.fill('无法找到的关键词');await page.getByRole('button',{name:'搜索',exact:true}).click();await expect(page.getByText('没有找到相关结果')).toBeVisible();
 await page.goto('/help-centre?q=one&q=two');await expect(page.getByText('搜索条件不正确')).toBeVisible();
 await page.goto('/help-centre?q='+encodeURIComponent('x'.repeat(121)));await expect(page.getByText('搜索条件不正确')).toBeVisible();
 await page.unrouteAll();await fixture(page,{unsafe:true});await page.goto('/help-centre?q='+encodeURIComponent('<script>'));await expect(page.getByRole('status')).toContainText('找到 1 项');
 await expect(page.locator('.gitbook-search-results script')).toHaveCount(0);
 expect(await page.evaluate(()=>Object.prototype.hasOwnProperty.call(window,'searchInjected'))).toBe(false);
});

test('pagination preserves query, total, browser history and out of range recovery',async({page})=>{
 await fixture(page);await page.goto('/help-centre?q='+encodeURIComponent('域名'));
 const results=page.getByRole('list',{name:'搜索结果列表'});await expect(results.getByRole('link')).toHaveCount(20);
 await page.getByRole('link',{name:'下一页',exact:true}).click();await expect(page).toHaveURL(/page=2/);await expect(page.getByRole('status')).toContainText('45 项');
 await page.reload();await expect(page.getByText('第 2 / 3 页')).toBeVisible();
 await page.getByRole('link',{name:'下一页',exact:true}).click();await expect(results.getByRole('link')).toHaveCount(5);
 await page.getByRole('link',{name:'上一页',exact:true}).click();await expect(page.getByText('第 2 / 3 页')).toBeVisible();
 await page.goto('/help-centre?q='+encodeURIComponent('域名')+'&page=99');await expect(page.getByText('这一页没有结果')).toBeVisible();
 await page.getByRole('link',{name:'返回第一页'}).click();await expect(results.getByRole('link')).toHaveCount(20);
});

test('clear, Escape and shortcuts preserve focus; Chinese composition does not submit early',async({page})=>{
 await fixture(page);await page.goto('/help-centre?q=');const input=page.getByRole('textbox',{name:'搜索资料'});
 await page.keyboard.press('Control+k');await expect(input).toBeFocused();await input.fill('费用');await input.press('Escape');await expect(input).toHaveValue('');await expect(input).toBeFocused();
 await input.fill('域名');await page.getByRole('button',{name:'清空搜索'}).click();await expect(input).toHaveValue('');await expect(input).toBeFocused();
 await input.fill('域名');await input.dispatchEvent('compositionstart');await input.press('Enter');await expect(page).toHaveURL(/q=$/);
 await input.dispatchEvent('compositionend');await input.press('Enter');await expect(page.getByRole('status')).toContainText('45 项');
});

test('service failure offers retry without fabricated zero results',async({page})=>{
 await fixture(page,{failed:true});await page.goto('/help-centre?q='+encodeURIComponent('域名'));
 await expect(page.getByRole('alert')).toContainText('搜索暂时无法加载');await expect(page.getByText(/找到 0 项/)).toHaveCount(0);
 await expect(page.getByRole('navigation',{name:'文章目录'}).getByRole('link')).toHaveCount(0);
 await page.unrouteAll();await fixture(page);await page.getByRole('link',{name:'重新搜索'}).click();await expect(page.getByRole('status')).toContainText('45 项');
});

test('submission announces pending before the next document arrives',async({page})=>{
 await fixture(page);await page.goto('/help-centre?q=');await page.unrouteAll();
 let release!:()=>void;const wait=new Promise<void>(resolve=>{release=resolve;});
 await fixture(page,{wait:()=>wait});
 let pendingObserved=false;await page.exposeFunction('reportSearchPending',()=>{pendingObserved=true;});
 // Observe before navigation: page.evaluate may wait for a new execution context
 // while the deliberately delayed document is pending.
 await page.evaluate(()=>{const observer=new MutationObserver(()=>{if(document.querySelector('.search-pending')?.textContent==='正在搜索…'){void (window as unknown as {reportSearchPending:()=>Promise<void>}).reportSearchPending();observer.disconnect();}});observer.observe(document.body,{subtree:true,childList:true,characterData:true});});
 const input=page.getByRole('textbox',{name:'搜索资料'});await input.fill('EPP');
 await input.press('Enter',{noWaitAfter:true});
 try{await expect.poll(()=>pendingObserved).toBe(true);}finally{release();}
 await expect(page.getByRole('status')).toContainText('找到 1 项');
});


test('overlong pasted input is rejected visibly without truncating the employee query',async({page})=>{
 await fixture(page);await page.goto('/help-centre?q=');const input=page.getByRole('textbox',{name:'搜索资料'});
 const query='域'.repeat(121);await input.fill(query);await expect(input).toHaveValue(query);
 await input.press('Enter');await expect(page.getByRole('alert')).toContainText('最多 120 个字符');await expect(page).toHaveURL(/q=$/);await expect(input).toHaveAttribute('aria-invalid','true');
 await input.fill('EPP');await input.press('Enter');await expect(page.getByRole('status')).toContainText('找到 1 项');
});

// This fixture receives an already authorized server result; DB tests verify selection/counts.
test('unified body results show type revision context and retain canonical reader navigation',async({page},info)=>{
 const result:TitleSearch={status:'ready',query:'二审',page:1,pages:1,total:4,results:articles.slice(0,4).map((a,i)=>({...a,href:i===3?'/help-centre/qa?question=search-3#qa-search-3':a.href,breadcrumbs:['域名操作'],snippet:'发布前需要另一位管理员二审；批准后才能安排发布。',kind:(['article','ops','reference','qa'] as const)[i],revision:2}))};
 await fixture(page,{serverSearch:result});await page.goto('/help-centre?q='+encodeURIComponent('二审'));
 const list=page.getByRole('list',{name:'搜索结果列表'});await expect(list.getByRole('link')).toHaveCount(4);await expect(list.locator('.search-result-snippet .search-match')).toHaveText(['二审','二审','二审','二审']);await expect(list).toContainText('OPS Internal');await expect(list).toContainText('Reference');await expect(list).toContainText('Q&A');await expect(list).toContainText('正式版本 2');await expect(page.getByText('搜索你有权阅读的已发布资料：标题、标签和正文。')).toBeVisible();
 await expect(page.getByRole('status')).toContainText('找到 4 项结果');await expect(list.getByRole('link',{name:'查看答案：'+articles[3].title})).toHaveAttribute('href','/help-centre/qa?question=search-3#qa-search-3');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`output/verification/unified-search-${info.project.name}.png`,fullPage:true,animations:'disabled'});await page.evaluate(()=>document.documentElement.dataset.theme='dark');await page.screenshot({path:`output/verification/unified-search-dark-${info.project.name}.png`,fullPage:true,animations:'disabled'});
 await list.getByRole('link').first().focus();await page.keyboard.press('Enter');await expect(page).toHaveURL(/article=search-0/);await expect(page.getByRole('heading',{level:1})).toHaveText(articles[0].title);
});
test('snippet markup stays text and a failed fresh search does not reuse previous result metadata',async({page})=>{
 const result:TitleSearch={status:'ready',query:'script',page:1,pages:1,total:1,results:[{...articles[0],breadcrumbs:[],snippet:'<script>window.snippetInjected=true</script>',kind:'ops',revision:7}]};
 await fixture(page,{serverSearch:result});await page.goto('/help-centre?q=script');await expect(page.locator('.search-result-snippet')).toHaveText('<script>window.snippetInjected=true</script>');await expect(page.locator('.gitbook-search-results script')).toHaveCount(0);expect(await page.evaluate(()=>Object.hasOwn(window,'snippetInjected'))).toBe(false);
 await page.unrouteAll();await fixture(page,{serverSearch:result,failed:true});await page.reload();await expect(page.getByRole('alert')).toContainText('搜索暂时无法加载');await expect(page.locator('.search-result-snippet')).toHaveCount(0);await expect(page.getByText(/正式版本 7/)).toHaveCount(0);await expect(page.getByText(/找到 1 项/)).toHaveCount(0);
});
