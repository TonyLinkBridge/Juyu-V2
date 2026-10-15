import {expect,test} from '@playwright/test';

test('Fumadocs confirms a delayed navigation on the clicked link while the current page stays usable',async({page},info)=>{
 test.setTimeout(60000);
 await page.goto('/design-preview/fumadocs-reader');
 await expect(page.locator('[data-reader-ready="true"]')).toBeVisible();
 const currentTitle=await page.locator('article h1').first().innerText();
 const mobile=info.project.name==='mobile';
 if(mobile)await page.getByRole('button',{name:'开启侧边栏'}).click();
 const sidebar=page.locator(mobile?'#nd-sidebar-mobile':'#nd-sidebar');
 const target=sidebar.getByRole('link',{name:/^如何找回密码/});
 if(!await target.isVisible())await sidebar.getByRole('button',{name:'账户安全',exact:true}).click();
 await expect(target).toBeVisible();
 const href=await target.getAttribute('href');
 let requests=0,release=()=>{};
 const responseGate=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/design-preview/fumadocs-reader/example-password*',async route=>{
  requests++;
  await responseGate;
  await route.continue();
 });
 try{
  expect(requests).toBe(0);
  await target.click();
  await expect(target.getByRole('status',{name:'正在打开页面'})).toBeVisible({timeout:1500});
  expect(requests).toBeGreaterThan(0);
  await expect(page.locator('article h1').first()).toHaveText(currentTitle);
  await expect(sidebar.getByRole('button',{name:'账户安全',exact:true})).toBeEnabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(target.locator('.juyu-nav-pending')).toHaveCSS('animation-name','none');
  await page.screenshot({path:`output/verification/publication-pending-${info.project.name}.png`});
 }finally{release();}
 await expect(page).toHaveURL(new RegExp(`${href}$`));
 await expect(page.getByRole('status',{name:'正在打开页面'})).toHaveCount(0);
 // This isolated preview server has no company session/database. The destination
 // must remain protected instead of exposing content from the previous page.
 await expect(page.locator('article h1')).toHaveCount(0);
});
