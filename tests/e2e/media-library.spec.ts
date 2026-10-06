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
