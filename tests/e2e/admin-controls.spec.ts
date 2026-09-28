import {expect,test} from '@playwright/test';

test.beforeEach(async({page})=>{
 await page.emulateMedia({colorScheme:'light'});
 await page.goto('/design-preview/admin');
 await expect(page.getByRole('heading',{name:'内容管理',exact:true})).toBeVisible();
});

test('admin primary action keeps its intended white label',async({page})=>{
 const create=page.getByRole('link',{name:/新建文章/});
 await expect(create).toHaveAttribute('href','/admin/editor');
 await expect(create).toHaveCSS('color','rgb(255, 255, 255)');
 await Promise.all([page.waitForURL(/\/admin\/editor$/),create.click()]);
});

test('admin uses the complete Fumadocs theme switch layout and behavior',async({page},testInfo)=>{
 test.skip(testInfo.project.name==='mobile','The desktop theme control intentionally moves into the mobile account menu.');
 const toggle=page.locator('.app-topbar button[data-theme-toggle]');
 await expect(toggle).toBeVisible();
 const box=await toggle.boundingBox();
 expect(box).not.toBeNull();
 expect(box!.width).toBeGreaterThan(box!.height);

 const icons=toggle.locator('svg');
 await expect(icons).toHaveCount(2);
 const positions=await icons.evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().top));
 expect(Math.abs(positions[0]-positions[1])).toBeLessThan(2);

 await toggle.click();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.classList.contains('dark'))).toBe(true);
});
