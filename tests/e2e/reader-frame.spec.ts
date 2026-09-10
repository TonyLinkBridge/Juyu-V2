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
