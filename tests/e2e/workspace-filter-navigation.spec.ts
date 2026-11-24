import {test,expect} from '@playwright/test';

test.skip(process.env.E2E_DEV!=='1','Local sample routes are intentionally unavailable in production builds.');

test('the full admin shell keeps type labels on one line despite route CSS order',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});
 await page.goto('/design-preview/admin');
 const select=page.getByRole('combobox',{name:'资料类型'});
 await expect(select).toBeVisible();
 await expect.poll(()=>select.evaluate(node=>node.getBoundingClientRect().width)).toBeGreaterThanOrEqual(150);
 await select.click();
 const option=page.getByRole('option',{name:'知识文章',exact:true});
 expect(await option.evaluate(node=>{const range=document.createRange();range.selectNodeContents(node.querySelector('span')!);return range.getClientRects().length;})).toBe(1);
});

test('actual Next filter navigation holds feedback until the sample response completes',async({page})=>{
 await page.goto('/design-preview/admin-controls');
 let release!:()=>void;
 const gate=new Promise<void>(resolve=>{release=resolve;});
 await page.route(url=>url.pathname==='/design-preview/admin-controls'&&url.searchParams.get('kind')==='ops',async route=>{await gate;await route.continue();});
 await page.getByRole('combobox',{name:'资料类型'}).click();
 await page.getByRole('option',{name:'OPS Internal',exact:true}).click();
 await expect(page.getByRole('button',{name:'正在筛选…',exact:true})).toBeDisabled();
 await expect(page.getByRole('status').filter({hasText:'正在筛选，请稍候'})).toBeVisible();
 release();
 await expect(page).toHaveURL(/kind=ops/);
 await expect(page.getByRole('heading',{name:'没有符合条件的内容'})).toBeVisible();
 await expect(page.getByRole('button',{name:'应用筛选',exact:true})).toBeEnabled();
});

test('without JavaScript the sample filter retains its native GET fallback',async({browser,baseURL})=>{
 const context=await browser.newContext({javaScriptEnabled:false,baseURL});
 const page=await context.newPage();
 try{
  await page.goto('/design-preview/admin-controls');
  await page.getByLabel('资料类型').selectOption('qa');
  await page.getByRole('button',{name:'应用筛选',exact:true}).click();
  await expect(page).toHaveURL(/kind=qa/);
  await expect(page.getByRole('heading',{name:'没有符合条件的内容'})).toBeVisible();
 }finally{await context.close();}
});
