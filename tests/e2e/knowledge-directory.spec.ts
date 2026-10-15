import {test,expect} from '@playwright/test';
const base='/design-preview/knowledge-directory';
const category='00000000-0000-4000-8000-000000000001';

test('category overview leads to an article list and preserves the supplied article destination',async({page},info)=>{
 test.setTimeout(60000);
 await page.goto(base);
 await expect(page.locator('[data-knowledge-directory]')).toBeVisible();
 await expect(page.locator('.directory-category-card')).toHaveCount(4);
 const membership=page.locator('.directory-category-card').filter({has:page.getByRole('heading',{name:'会员权益',exact:true})});
 await expect(membership).toHaveAttribute('href',`/help-centre/categories/${category}`);
 await expect(membership).toContainText('普通会员');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`output/verification/knowledge-directory-${info.project.name}.png`,fullPage:true});
 // Only this isolated test browser maps the formal destination to its local fixture.
 // Production routes keep their account gate and server-authorized data reads.
 await page.route(`**/help-centre/categories/${category}*`,route=>route.fulfill({status:302,headers:{location:base+'?category='+category}}));
 await membership.click();
 await expect(page.getByRole('heading',{name:'会员权益',level:1})).toBeVisible();
 await expect(page.locator('.directory-article-list li')).toHaveCount(4);
 const article=page.locator('.directory-article-list').getByRole('link',{name:/普通会员/});
 await expect(article).toHaveAttribute('href','/design-preview/fumadocs-reader');
 await page.screenshot({path:`output/verification/knowledge-category-${info.project.name}.png`,fullPage:true});
 await article.click();
 await expect(page.getByRole('heading',{name:'如何修改账户邮箱',level:1})).toBeVisible();
});

test('empty directory explains missing publications and has no fabricated categories',async({page})=>{
 await page.goto(base+'?empty=1');
 await expect(page.getByRole('heading',{name:'暂无可阅读的正式资料'})).toBeVisible();
 await expect(page.locator('.directory-category-card')).toHaveCount(0);
 await expect(page.getByRole('link',{name:'返回知识库首页'})).toHaveAttribute('href','/help-centre');
});

test('English directory retains its locale and search feature setting',async({page})=>{
 await page.goto(base+'?lang=en&search=off');
 await expect(page.locator('.directory-category-card')).toHaveCount(4);
 await expect(page.locator('.home-search')).toHaveCount(0);
 await expect(page.locator('.directory-category-card').first()).toHaveAttribute('href',`/help-centre/categories/${category}?lang=en`);
 await expect(page.getByRole('link',{name:'Back to the Help Centre'})).toHaveAttribute('href','/help-centre?lang=en');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('dark theme uses the existing readable JUYU brand color for topic actions',async({page},info)=>{
 await page.goto(base);
 if(info.project.name==='mobile')await page.getByRole('button',{name:'Toggle Menu',exact:true}).click();
 await page.getByRole('button',{name:'切换主题',exact:true}).click();
 await expect(page.locator('html')).toHaveClass(/dark/);
 await expect(page.locator('.directory-category-action').first()).toHaveCSS('color','rgb(255, 160, 170)');
 await expect(page.locator('.directory-category-card').first()).toBeVisible();
});
