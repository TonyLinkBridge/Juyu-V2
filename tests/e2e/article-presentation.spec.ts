import {readFile} from 'node:fs/promises';
import {test,expect} from '@playwright/test';
import {navigationBrowserBundle} from '../helpers/navigation-browser';
let bundle:Awaited<ReturnType<typeof navigationBrowserBundle>>;
let image:Buffer;
test.beforeAll(async()=>{
 bundle=await navigationBrowserBundle();
 // Synthetic test asset, not an uploaded or official article cover.
 image=await readFile('tests/fixtures/article-cover.png');
});
const id='11111111-1111-4111-8111-111111111111';
async function fixture(page:import('@playwright/test').Page,options:{missing?:boolean;failedImage?:boolean;unsafeCover?:boolean;noMetadata?:boolean}={}){
 await page.route('**/api/assets/**',route=>options.failedImage?route.fulfill({status:404,body:'not found'}):route.fulfill({contentType:'image/png',body:image,headers:{'Cache-Control':'private, no-store'}}));
 await page.route(url=>url.pathname==='/help-centre',route=>{
 const data=JSON.stringify({hydrateAfterImages:options.failedImage,pages:[{type:'document',id:'cover-page',title:'封面和标签 · 本地示例',href:'/help-centre?article=cover-page'}],requested:'cover-page',article:options.missing?null:{id:'cover-page',title:'封面和标签 · 本地示例',revision:2,body:'# 阅读说明\n\n这是封面和标签的本地验收示例，不是正式业务资料。\n\n## 操作步骤\n\n发布前，封面和标签会随草稿一起接受审核。',...(!options.noMetadata?{tags:['域名操作','客户支持','一个很长的中文标签用于确认手机换行排版'],cover:{assetId:options.unsafeCover?'https://outside.example/secret':id,alt:'本地测试封面',position:30}}:{})},announcement:{id:'cover-example',revision:'1',message:'本地外观验收 · 示例内容'}}).replace(/</g,'\\u003c');
 return route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.css}</style></head><body><div id="presentation"></div><script id="data" type="application/json">${data}</script><script>${bundle.script}</script></body></html>`});
 });
}
test('published cover uses private delivery and tags wrap in both palettes',async({page},info)=>{
 await fixture(page);await page.goto('/help-centre');const cover=page.getByRole('img',{name:'本地测试封面'});
 await expect(cover).toHaveAttribute('src',`/api/assets/${id}`);await expect.poll(()=>cover.evaluate(el=>(el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
 await expect(page.getByRole('list',{name:'文章标签'}).getByRole('listitem')).toHaveText(['域名操作','客户支持','一个很长的中文标签用于确认手机换行排版']);
 await expect(cover).toHaveCSS('object-position','50% 30%');
 for(const [name,mode] of [['浅色','light'],['深色','dark']]){
  await page.getByRole('radio',{name,exact:true}).check();await page.evaluate(()=>window.scrollTo(0,0));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  await page.screenshot({path:`output/verification/cover-tags-${mode}-${info.project.name}.png`,fullPage:true});
 }
 await expect(page.locator('#presentation')).not.toHaveAttribute('data-hydration-error');
});
test('cover failures show a recovery message while text remains readable',async({page})=>{
 await fixture(page,{failedImage:true});await page.goto('/help-centre');await expect(page.getByText('封面暂时无法加载')).toBeVisible();
 await expect(page.getByRole('heading',{name:'封面和标签 · 本地示例'})).toBeVisible();await expect(page.getByRole('img')).toHaveCount(0);await expect(page.locator('#presentation')).not.toHaveAttribute('data-hydration-error');
});
test('no metadata, missing article and invalid external cover never expose a cover request',async({page})=>{
 const requests:string[]=[];page.on('request',req=>{if(req.url().includes('/api/assets/')||req.url().includes('outside.example'))requests.push(req.url());});
 for(const options of [{noMetadata:true},{missing:true},{unsafeCover:true}]){
  await page.unrouteAll();await fixture(page,options);await page.goto('/help-centre');await expect(page.getByRole('heading',{level:1})).toBeVisible();await expect(page.getByRole('img')).toHaveCount(0);
 }
 expect(requests).toEqual([]);
});
