import {test,expect} from '@playwright/test';
import {navigationBrowserBundle} from '../helpers/navigation-browser';

let bundle:Awaited<ReturnType<typeof navigationBrowserBundle>>;
test.beforeAll(async()=>{bundle=await navigationBrowserBundle();});

test('search shows permissioned live results and keyboard opens the selected answer',async({page})=>{
 await page.route('**/api/search?*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({status:'ready',query:'域名',page:1,pages:1,total:2,results:[
  {id:'a',title:'域名转出规则',href:'/help-centre?article=a',breadcrumbs:['账户'],kind:'article',snippet:'正式规则'},
  {id:'q',title:'域名转出常见问题',href:'/help-centre/qa?question=q',breadcrumbs:[],kind:'qa',snippet:'标准答案'}
 ]})}));
 await page.route('**/__search_dialog_fixture',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>${bundle.css}</style></head><body><div id="search-input"></div><script id="data" type="application/json">{}</script><script>${bundle.script}</script></body></html>`}));
 await page.route('**/help-centre/qa?question=q',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Q&A opened</title>'}));
 await page.goto('/__search_dialog_fixture');
 const input=page.getByRole('combobox',{name:'搜索资料'});await input.fill('域名');
 const list=page.getByRole('listbox',{name:'即时搜索结果'});await expect(list.getByRole('option')).toHaveCount(2);
 await input.press('ArrowDown');await input.press('ArrowDown');await input.press('Enter');
 await expect(page).toHaveURL(/\/help-centre\/qa\?question=q$/);
});

test('search keeps full results as fallback and does not show stale responses',async({page})=>{
 await page.route('**/api/search?*',async route=>{
  const query=new URL(route.request().url()).searchParams.get('q');
  if(query==='旧')await new Promise(resolve=>setTimeout(resolve,500));
  await route.fulfill({contentType:'application/json',body:JSON.stringify({status:'ready',query,page:1,pages:1,total:1,results:[{id:query,title:`${query}资料`,href:'/help-centre?article=one',breadcrumbs:[],kind:'article'}]})});
 });
 await page.route('**/__search_dialog_fixture',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>${bundle.css}</style></head><body><div id="search-input"></div><script id="data" type="application/json">{}</script><script>${bundle.script}</script></body></html>`}));
 await page.goto('/__search_dialog_fixture');const input=page.getByRole('combobox',{name:'搜索资料'});
 await input.fill('旧');await expect(page.getByRole('listbox')).toBeVisible();await input.fill('新');
 await expect(page.getByRole('option',{name:/新资料/})).toBeVisible();await expect(page.getByRole('option',{name:/旧资料/})).toHaveCount(0);
 await input.press('Escape');await expect(page.getByRole('listbox')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'搜索',exact:true})).toBeVisible();
});

test('changing search scope requests matching results and keeps scope on full-results link',async({page})=>{
 const scopes:string[]=[];
 await page.route('**/api/search?*',route=>{
  const scope=new URL(route.request().url()).searchParams.get('scope')??'all';scopes.push(scope);
  return route.fulfill({contentType:'application/json',body:JSON.stringify({status:'ready',query:'域名',page:1,pages:1,total:1,results:[{id:scope,title:`${scope} 域名资料`,href:'/help-centre?article=one',breadcrumbs:[],kind:scope==='all'?'article':scope}]})});
 });
 await page.route('**/__search_dialog_fixture',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>${bundle.css}</style></head><body><div id="search-input"></div><script id="data" type="application/json">{}</script><script>${bundle.script}</script></body></html>`}));
 await page.goto('/__search_dialog_fixture');await page.getByRole('combobox',{name:'搜索资料'}).fill('域名');
 await page.getByRole('button',{name:'Q&A 问答'}).click();
 await expect(page.getByRole('option',{name:/qa 域名资料/})).toBeVisible();
 await expect(page.getByRole('link',{name:/查看全部 1 项结果/})).toHaveAttribute('href','/help-centre?q=%E5%9F%9F%E5%90%8D&scope=qa');
 expect(scopes).toContain('qa');
});
test('recent searches reappear within this tab, keep their scope and can be cleared',async({page})=>{
 await page.route('**/__search_dialog_fixture',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>${bundle.css}</style></head><body><div id="search-input"></div><script id="data" type="application/json">{}</script><script>${bundle.script}</script></body></html>`}));
 await page.route('**/api/search?*',route=>route.fulfill({json:{status:'ready',query:'域名',page:1,pages:1,total:0,results:[]}}));
 await page.route('**/help-centre?*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Search opened</title>'}));
 await page.goto('/__search_dialog_fixture');const input=page.getByRole('combobox',{name:'搜索资料'});await input.fill('域名');await page.getByRole('button',{name:'Q&A 问答'}).click();await page.getByRole('button',{name:'搜索',exact:true}).click();await expect(page).toHaveURL(/q=%E5%9F%9F%E5%90%8D/);
 await page.goto('/__search_dialog_fixture');await input.focus();await expect(page.getByRole('listbox',{name:'最近搜索'}).getByRole('option',{name:/域名/})).toBeVisible();await expect(page.getByRole('listbox',{name:'最近搜索'}).getByRole('option',{name:/域名/})).toHaveAttribute('href','/help-centre?q=%E5%9F%9F%E5%90%8D&scope=qa');await page.getByRole('button',{name:'清除记录'}).click();await expect(page.getByRole('listbox',{name:'最近搜索'})).toHaveCount(0);
});
