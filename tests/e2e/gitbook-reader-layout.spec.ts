import {test,expect} from '@playwright/test';
import {fixtureAssets} from '../helpers/fixture-assets';
import {navigationBrowserBundle} from '../helpers/navigation-browser';
let bundle:Awaited<ReturnType<typeof navigationBrowserBundle>>;
test.beforeAll(async()=>{bundle=await navigationBrowserBundle();});
test('GitBook reading grid stays aligned with the header and keeps nested navigation usable',async({page},info)=>{
 await fixtureAssets(page,'navigation');
 const mobile=info.project.name==='mobile';
 if(!mobile)await page.setViewportSize({width:1710,height:983});
 const article={id:'email',title:'如何修改账户邮箱',revision:22,publicationNumber:1,feedback:{memberId:'fixture',value:null},body:'# 操作步骤\n\n这是已发布文章的本地展示样例。'};
 const data={article,requested:'email',pages:[{type:'group',id:'accounts',title:'账户管理',descendants:[{type:'group',id:'security',title:'账户安全',descendants:[{type:'document',id:'email',title:article.title,href:'/help-centre?article=email'},{type:'document',id:'long',title:'一个很长的文章标题用于检查在小屏幕上的换行显示是否完整以及是否挤出目录范围',href:'/help-centre?article=long'}]}]}]};
 await page.route('**/gitbook-layout-fixture',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-CN" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.css}</style></head><body><div class="entry-frame"><div class="reader-chrome"><header class="site-header has-search"><a class="juyu-brand"><span>Help Centre</span></a><div class="header-search"><button class="header-search-toggle">搜索</button><div class="header-search-panel"><input aria-label="搜索资料"></div></div><div class="account-controls"><button>账号</button></div></header></div><div id="reader"></div></div><script id="data" type="application/json">${JSON.stringify(data)}</script><script>${bundle.script}</script></body></html>`}));
 await page.goto('/gitbook-layout-fixture');
 if(mobile)await page.getByRole('button',{name:'打开文章目录'}).click();
 const nav=page.getByRole('navigation',{name:'文章目录'});
 await expect(nav.getByRole('link',{name:article.title,exact:true})).toBeVisible();
 await nav.getByRole('button',{name:'账户管理',exact:true}).click();
 await expect(nav.getByRole('link',{name:article.title,exact:true})).toHaveCount(0);
 await page.screenshot({path:`output/verification/gitbook-layout-collapsed-${info.project.name}.png`});
 await nav.getByRole('button',{name:'账户管理',exact:true}).click();
 const long=nav.getByRole('link',{name:/一个很长的文章标题/});
 expect(await long.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
 if(!mobile){
  const layout=await page.locator('.reader-layout').boundingBox(),main=await page.locator('#main-content').boundingBox(),search=await page.locator('.header-search').boundingBox(),rail=await page.locator('.gitbook-page-aside').boundingBox();
  expect(layout!.x).toBe(167);expect(main!.x).toBe(503);expect(main!.width).toBe(768);expect(search!.x).toBe(main!.x);expect(rail!.x).toBe(1287);
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`output/verification/gitbook-layout-light-${info.project.name}.png`});
 await page.evaluate(()=>document.documentElement.dataset.theme='dark');
 expect(await nav.locator('[aria-current="page"]').evaluate(e=>getComputedStyle(e).color)).not.toBe('rgb(0, 0, 0)');
 await page.screenshot({path:`output/verification/gitbook-layout-dark-${info.project.name}.png`});
 if(mobile){await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'有帮助',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'补充说明（选填）'})).toBeFocused();
});
