import {test,expect,type Page} from '@playwright/test';
import {mediaLibraryBrowserBundle} from '../helpers/media-library-browser';
import type {MediaLibraryData} from '../../src/media/library';
let bundle:Awaited<ReturnType<typeof mediaLibraryBrowserBundle>>;
test.beforeAll(async()=>{bundle=await mediaLibraryBrowserBundle();});
const items=Array.from({length:12},(_,i)=>({id:`aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12,'0')}`,filename:'image.png',mime:'image/png',size:'1024',createdAt:'2026-09-30T01:00:00.000Z',documentId:'local-document',documentTitle:`MFA 操作 ${i+1}`,uploadedBy:'本地测试上传者',canUpload:true,usages:[]}));
const data:MediaLibraryData={query:{q:'',type:'all',sort:'recent',page:1,view:'grid'},items,total:12,page:1,pages:1,counts:{all:12,image:12,video:0,audio:0,file:0},selected:null};
async function mount(page:Page,seed=data){
 await page.route('**/__media_library_fixture*',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.css}</style></head><body><div id="media-library"></div><script id="data" type="application/json">${JSON.stringify({data:seed})}</script><script>${bundle.script}</script></body></html>`}));
 await page.goto('/__media_library_fixture');
}
test('thumbnail loads stay bounded when a page has many images',async({page})=>{
 let active=0,maximum=0,finished=0;
 await page.route('**/api/admin/assets/**',async r=>{active++;maximum=Math.max(maximum,active);await new Promise(resolve=>setTimeout(resolve,180));await r.fulfill({path:'tests/fixtures/article-cover.png',contentType:'image/png'});active--;finished++;});
 await mount(page);
 await page.locator('.admin-data-pagination').scrollIntoViewIfNeeded();
 await expect.poll(()=>finished).toBeGreaterThanOrEqual(3);
 expect(maximum).toBeLessThanOrEqual(3);
});
test('a failed thumbnail can retry without opening the detail page or reloading the library',async({page})=>{
 let calls=0;
 await page.route('**/api/admin/assets/**',r=>++calls===1?r.fulfill({status:502,json:{error:'FILE_UNAVAILABLE'}}):r.fulfill({path:'tests/fixtures/article-cover.png',contentType:'image/png'}));
 await mount(page,{...data,items:items.slice(0,1),total:1});
 await expect(page.getByText('预览暂时无法读取',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'重新加载预览：MFA 操作 1 · image.png',exact:true}).click();
 await expect(page.locator('.media-library-thumbnail img')).toHaveJSProperty('naturalWidth',400);
 await expect(page).toHaveURL(/__media_library_fixture$/);expect(calls).toBe(2);
});
test('file links identify their article and search explains the supported fields',async({page},info)=>{
 await page.route('**/api/admin/assets/**',r=>r.fulfill({path:'tests/fixtures/article-cover.png',contentType:'image/png'}));
 await mount(page,{...data,items:items.slice(0,1),total:1});
 await expect(page.getByRole('searchbox',{name:'搜索文件、文章或上传者'})).toBeVisible();
 await expect(page.getByRole('link',{name:'查看文件 MFA 操作 1 · image.png',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`output/verification/media-library-${info.project.name}.png`,fullPage:true});
});

test('pending thumbnails reserve their space and reveal the image when the request finishes',async({page})=>{
 let finish!:()=>void;const gate=new Promise<void>(resolve=>{finish=resolve;});
 await page.route('**/api/admin/assets/**',async route=>{await gate;await route.fulfill({path:'tests/fixtures/article-cover.png',contentType:'image/png'});});
 await mount(page,{...data,items:items.slice(0,1),total:1});
 const pending=page.getByRole('img',{name:'正在加载图片预览：MFA 操作 1 · image.png',exact:true});
 await expect(pending).toBeVisible();await expect(pending).toHaveAttribute('aria-busy','true');
 const thumbnail=page.locator('.media-library-thumbnail');const before=await thumbnail.boundingBox();
 finish();await expect(thumbnail.locator('img')).toHaveJSProperty('naturalWidth',400);await expect(pending).toHaveCount(0);
 const after=await thumbnail.boundingBox();expect(after?.height).toBe(before?.height);
});

test('official filter chips remove one condition and preserve sort and view',async({page})=>{
 await page.route('**/api/admin/assets/**',r=>r.fulfill({path:'tests/fixtures/article-cover.png',contentType:'image/png'}));
 await mount(page,{...data,query:{...data.query,q:'MFA',type:'image',sort:'name',view:'list'}});
 await expect(page.getByRole('group',{name:'已应用的筛选'})).toContainText('MFA');
 await page.route('**/admin/media?**',r=>r.fulfill({contentType:'text/html',body:'<p>Filtered result</p>'}));
 await page.getByRole('button',{name:'移除 搜索: MFA',exact:true}).click();await expect(page).toHaveURL(/\/admin\/media\?type=image&sort=name&view=list$/);
});
test('official table header requests a global server sort, preserving search and type',async({page},info)=>{
 await page.route('**/api/admin/assets/**',r=>r.fulfill({path:'tests/fixtures/article-cover.png',contentType:'image/png'}));
 await mount(page,{...data,query:{...data.query,q:'MFA',type:'image',view:'list'},items:items.slice(0,2),total:35,pages:2});
 const primary=page.getByRole('button',{name:'上传文件',exact:true});
 const rgb=await primary.evaluate(el=>getComputedStyle(el).backgroundColor.match(/\d+/g)!.map(Number));expect(rgb[0]).toBeGreaterThan(rgb[1]*2);expect(rgb[0]).toBeGreaterThan(rgb[2]*2);
 const table=page.getByRole('table',{name:'媒体文件列表'});await expect(table).toBeVisible();
 await expect(table.getByRole('columnheader',{name:/上传时间/})).toHaveAttribute('aria-sort','descending');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`output/verification/media-arc-table-${info.project.name}.png`,fullPage:true});
 await page.route('**/admin/media?**',r=>r.fulfill({contentType:'text/html',body:'<p>Sorted result</p>'}));
 await table.getByRole('button',{name:/大小/}).click();await expect(page).toHaveURL(/q=MFA&type=image&sort=size&direction=asc&view=list$/);
});
async function openUpload(page:Page){
 await page.route('**/api/admin/media/targets?**',r=>r.fulfill({json:{items:[{id:'local-document',title:'本地测试文章'}],page:1,pages:1,total:1}}));
 await mount(page,{...data,items:[],total:0});await page.getByRole('button',{name:'上传文件',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'上传文件',exact:true});await dialog.getByRole('radio',{name:'本地测试文章'}).check();
 await dialog.locator('input[type=file]').setInputFiles({name:'example.txt',mimeType:'text/plain',buffer:Buffer.from('JUYU local fixture')});
 return dialog;
}
test('dropzone and action button wait for confirmed upload and prevent duplicate clicks',async({page},info)=>{
 let calls=0,release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);
 await page.route('**/api/admin/media/local-document/upload',async r=>{calls++;await gate;await r.fulfill({status:201,json:{id:items[0].id,status:'ready'}});});
 const dialog=await openUpload(page);await expect(dialog).toContainText('example.txt');
 const button=dialog.getByRole('button',{name:'上传文件',exact:true});await button.evaluate(el=>{el.dispatchEvent(new MouseEvent('click',{bubbles:true}));el.dispatchEvent(new MouseEvent('click',{bubbles:true}));});
 await expect(button).toHaveAttribute('aria-busy','true');await expect(dialog.getByRole('button',{name:'关闭上传窗口'})).toBeDisabled();await expect(dialog.getByRole('button',{name:'移除 example.txt'})).toBeDisabled();
 await expect.poll(()=>calls).toBe(1);release();await expect(dialog.getByRole('button',{name:'完成，查看文件'})).toBeVisible();await expect(dialog).toContainText('已上传');
 await expect(dialog.getByRole('button',{name:'完成，查看文件'})).toBeInViewport({ratio:1});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`output/verification/media-arc-upload-${info.project.name}.png`,fullPage:true});
});
test('uncertain upload result keeps file and forbids an unsafe retry',async({page})=>{
 let calls=0;await page.route('**/api/admin/media/local-document/upload',r=>{calls++;return r.fulfill({status:502,json:{error:'UNAVAILABLE'}});});
 const dialog=await openUpload(page);await dialog.getByRole('button',{name:'上传文件',exact:true}).click();
 await expect(dialog).toContainText('上传结果未确认');await expect(dialog.getByRole('button',{name:'上传文件',exact:true})).toBeDisabled();await expect(dialog.getByRole('button',{name:'重试 example.txt',exact:true})).toHaveCount(0);await expect(dialog.getByRole('button',{name:'关闭上传窗口'})).toBeEnabled();expect(calls).toBe(1);
});
test('confirmed validation failure permits an explicit retry without losing the selection',async({page})=>{
 let calls=0;await page.route('**/api/admin/media/local-document/upload',r=>++calls===1?r.fulfill({status:400,json:{error:'INVALID_UPLOAD'}}):r.fulfill({status:201,json:{id:items[0].id,status:'ready'}}));
 const dialog=await openUpload(page);await dialog.getByRole('button',{name:'上传文件',exact:true}).click();await dialog.getByRole('button',{name:'重试 example.txt',exact:true}).click();await expect(dialog.getByRole('button',{name:'完成，查看文件'})).toBeVisible();expect(calls).toBe(2);
});

test('official add-filter menu and clear-all retain sorting and the chosen view',async({page})=>{
 await mount(page,{...data,items:[],total:0,query:{...data.query,q:'MFA',sort:'size',direction:'asc',view:'list',page:2}});
 await page.route('**/admin/media?**',r=>r.fulfill({contentType:'text/html',body:'<p>Filter fixture</p>'}));
 await page.getByRole('button',{name:'添加筛选',exact:true}).click();
 await page.getByRole('menuitem',{name:/文件类型/}).click();
 await page.getByRole('menuitemradio',{name:'视频',exact:true}).click();
 await expect(page).toHaveURL(/q=MFA&type=video&sort=size&direction=asc&view=list$/);
 await mount(page,{...data,items:[],total:0,query:{...data.query,q:'MFA',type:'image',sort:'size',direction:'asc',view:'list',page:2}});
 await expect(page.getByRole('link',{name:'清除筛选',exact:true})).toHaveAttribute('href','/admin/media?sort=size&direction=asc&view=list');
 await page.getByRole('button',{name:'清除全部',exact:true}).click();await expect(page).toHaveURL(/sort=size&direction=asc&view=list$/);
});
