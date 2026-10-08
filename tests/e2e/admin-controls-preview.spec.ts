import {test,expect} from '@playwright/test';
import {arcBrowserBundle} from '../helpers/arc-browser';
import {resolve} from 'node:path';
let bundle:Awaited<ReturnType<typeof arcBrowserBundle>>;
test.beforeAll(async()=>{
 bundle=await arcBrowserBundle('admin-controls',`import React from 'react';import {createRoot} from 'react-dom/client';import {TasksFilterBar} from ${JSON.stringify(resolve('src/components/tasks/TasksFilterBar.tsx'))};import {CopyButton} from ${JSON.stringify(resolve('src/components/ui/copy-button.tsx'))};import {workspaceQuery} from ${JSON.stringify(resolve('src/workspace/model.ts'))};const query=workspaceQuery(Object.fromEntries(new URLSearchParams(location.search)));createRoot(document.getElementById('fixture')).render(React.createElement(React.Fragment,null,React.createElement(TasksFilterBar,{query,action:'/__controls'}),React.createElement('textarea',{'aria-label':'示例输入',defaultValue:'完整草稿\\n第二行'}),React.createElement(CopyButton,{value:'完整草稿\\n第二行',label:'复制当前输入'})));`);
});
async function open(page:import('@playwright/test').Page,query='kind=article&scope=submitted&view=list&page=3&status=in_review&q=域名'){
 await page.route(url=>url.pathname==='/__controls',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.css}</style></head><body><main style="padding:20px"><div id="fixture"></div></main><script>${bundle.script}</script></body></html>`}));
 await page.goto(`/__controls?${query}`);
}
test('official filter menu changes real status and preserves workspace context',async({page})=>{
 await open(page);await page.getByRole('button',{name:'添加筛选',exact:true}).click();
 await page.getByRole('menuitem',{name:/^内容状态/}).click();
 await page.getByRole('menuitemradio',{name:'已经发布',exact:true}).click();
 await expect(page).toHaveURL(/status=published/);
 const params=new URL(page.url()).searchParams;
 expect(params.get('kind')).toBe('article');expect(params.get('scope')).toBe('submitted');expect(params.get('view')).toBe('list');expect(params.get('page')).toBe('1');expect(params.get('q')).toBe('域名');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('clear keeps the content type and view, removes filters and resets pagination',async({page})=>{
 await open(page);await page.getByRole('button',{name:'清除全部',exact:true}).click();
 const params=new URL(page.url()).searchParams;
 expect(params.get('q')).toBe('');expect(params.get('status')).toBe('all');expect(params.get('scope')).toBe('all');expect(params.get('kind')).toBe('article');expect(params.get('view')).toBe('list');expect(params.get('page')).toBe('1');
});
test('search remains a native GET and resets pagination',async({page})=>{
 await open(page);await page.getByLabel('搜索标题').fill('新标题');await page.getByRole('button',{name:'应用筛选',exact:true}).click();
 const params=new URL(page.url()).searchParams;expect(params.get('q')).toBe('新标题');expect(params.get('status')).toBe('in_review');expect(params.get('page')).toBe('1');
});
test('copy waits for clipboard acknowledgement and preserves the complete draft',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{await new Promise(resolve=>setTimeout(resolve,200));(window as Window&{copiedDraft?:string}).copiedDraft=text;}}}));
 await open(page);await page.getByRole('button',{name:'复制当前输入',exact:true}).click();
 await expect(page.getByRole('button',{name:'正在复制…',exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'已复制',exact:true})).toHaveAttribute('data-copied','true');
 expect(await page.evaluate(()=>(window as Window&{copiedDraft?:string}).copiedDraft)).toBe('完整草稿\n第二行');
 await expect(page.getByLabel('示例输入')).toHaveValue('完整草稿\n第二行');
});
test('failed clipboard and legacy fallback show an honest error without losing input',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('denied');}}});document.execCommand=()=>false;});
 await open(page);await page.getByRole('button',{name:'复制当前输入',exact:true}).click();
 await expect(page.getByText('复制未成功，请手动选择文字复制。', {exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'复制当前输入',exact:true})).toHaveAttribute('data-copied','false');await expect(page.getByRole('button',{name:'复制当前输入',exact:true})).toBeFocused();await expect(page.getByLabel('示例输入')).toHaveValue('完整草稿\n第二行');
});

test('changing material type applies the real kind and keeps the search context',async({page})=>{
 await open(page);await page.getByLabel('资料类型').selectOption('ops');await expect(page).toHaveURL(/kind=ops/);const params=new URL(page.url()).searchParams;expect(params.get('scope')).toBe('submitted');expect(params.get('q')).toBe('域名');expect(params.get('page')).toBe('1');
});
