import {test,expect} from '@playwright/test';

test('loading layouts fit each page on desktop and mobile without decorative controls receiving focus',async({page},info)=>{
 test.setTimeout(60000);
 for(const screen of ['list','media','analytics','editor','reader']){
  await page.goto(`/design-preview/loading-${screen}`);
  const status=page.getByRole('status');await expect(status).toHaveCount(1);await expect(status).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const skeleton=page.locator('.juyu-skeleton');expect(await skeleton.count()).toBeGreaterThan(3);await expect(skeleton.first()).toBeVisible();
  expect(await skeleton.evaluateAll(elements=>elements.every(element=>element.getAttribute('aria-hidden')==='true'&&!element.hasAttribute('tabindex')))).toBe(true);
  await page.screenshot({path:`output/verification/loading-${screen}-${info.project.name}.png`,fullPage:true,animations:'disabled'});
 }
});

test('skeletons follow the existing dark theme and stop shimmer when reduced motion is requested',async({page},info)=>{
 await page.goto('/design-preview/loading-media');
 const skeleton=page.locator('.juyu-skeleton').first();await expect(skeleton).toBeVisible();
 const light=await skeleton.evaluate(element=>getComputedStyle(element).backgroundColor);
 await page.locator('.account-controls>[data-theme-toggle]').click();await expect(page.locator('html')).toHaveClass(/dark/);
 expect(await skeleton.evaluate(element=>getComputedStyle(element).backgroundColor)).not.toBe(light);
 await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.juyu-skeleton-shimmer')).toHaveCount(0);await expect(skeleton).toBeVisible();
 await page.screenshot({path:`output/verification/loading-media-dark-${info.project.name}.png`,fullPage:true,animations:'disabled'});
});


test('reader placeholders remain distinguishable from the page in both themes',async({page})=>{
 await page.goto('/design-preview/loading-reader');
 const skeleton=page.locator('.juyu-skeleton').first();
 for(const dark of [false,true]){
  if(dark){
   const toggle=page.getByRole('button',{name:'切换主题',exact:true});
   const mobileMenu=page.getByRole('button',{name:'开启侧边栏',exact:true});
   const collapsed=await mobileMenu.isVisible();if(collapsed)await mobileMenu.click();
   await toggle.click();await expect(page.locator('html')).toHaveClass(/dark/);
   if(collapsed)await page.locator('#nd-sidebar-mobile').getByRole('button',{name:'关闭侧边栏',exact:true}).click();
  }
  await expect(skeleton).toBeVisible();
  const colors=await skeleton.evaluate(element=>{
   let parent=element.parentElement;
   while(parent&&getComputedStyle(parent).backgroundColor==='rgba(0, 0, 0, 0)')parent=parent.parentElement;
   return {placeholder:getComputedStyle(element).backgroundColor,page:parent?getComputedStyle(parent).backgroundColor:''};
  });
  expect(colors.placeholder).not.toBe(colors.page);
 }
});
