import {test,expect} from '@playwright/test';
const base='/design-preview/fumadocs-reader';
const category='00000000-0000-4000-8000-000000000020';
for(const kind of ['ops','reference'] as const){
 test(`${kind} overview keeps original links and filters authorized topics`,async({page},info)=>{
  const fixture=`${base}?fixture=${kind}&collection=1`;
  await page.goto(fixture);
  const view=page.locator(`[data-collection-directory="${kind}"]`);
  await expect(view).toBeVisible();
  await expect(view.locator('.home-section-tabs a[aria-current="page"]')).toHaveAttribute('href',`/help-centre/${kind}`);
  const card=view.locator('.directory-category-card');
  await expect(card).toHaveCount(1);await expect(card).toHaveAttribute('href',`/help-centre/${kind}?category=${category}`);
  const articles=view.locator('.directory-article-list a');await expect(articles).toHaveCount(2);
  await expect(articles.first()).toHaveAttribute('href',kind==='ops'?'/help-centre/ops/ops-procedure':'/help-centre/reference?page=1&article=reference-fees#reference-detail');
  await page.route(`**/help-centre/${kind}?**`,route=>{
   const source=new URL(route.request().url());source.pathname=base;source.searchParams.set('fixture',kind);source.searchParams.set('collection','1');return route.fulfill({status:302,headers:{location:source.pathname+source.search}});
  });
  await card.click();await expect(view.locator('.directory-breadcrumbs [aria-current="page"]')).toContainText(kind==='ops'?'运营流程':'业务速查');
  await view.getByRole('searchbox').fill(kind==='ops'?'异常':'费用');await view.getByRole('button',{name:'搜索资料',exact:true}).click();
  await expect(view.locator('.directory-article-list a')).toHaveCount(1);
  await expect(view.getByRole('heading',{name:'搜索结果',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`output/verification/section-${kind}-${info.project.name}.png`,fullPage:true});
 });
 test(`${kind} empty denied and failure states never fabricate topics or expose article titles`,async({page})=>{
  for(const query of ['empty=1','state=denied','state=unavailable']){
   await page.goto(`${base}?fixture=${kind}&collection=1&${query}`);
   await expect(page.locator('.directory-category-card')).toHaveCount(0);await expect(page.locator('.directory-article-list a')).toHaveCount(0);
   if(query==='empty=1')await expect(page.getByRole('heading',{name:kind==='ops'?'暂时没有已发布的运营资料':'暂时没有已发布的速查资料',exact:true})).toBeVisible();
   else await expect(page.locator('[data-collection-directory]').getByRole('alert')).toBeVisible();
  }
 });
}
test('Q&A shares the overview style and still opens answers in place after category selection',async({page},info)=>{
 await page.goto(`${base}?fixture=qa&collection=1`);
 const qa=page.locator('[data-fumadocs-qa-page]');await expect(qa.locator('.home-section-tabs a[aria-current="page"]')).toHaveAttribute('href','/help-centre/qa');
 await expect(qa.getByRole('searchbox',{name:'搜索问题或答案'})).toHaveCount(1);
 const card=qa.locator('.directory-category-card').filter({has:page.getByRole('heading',{name:'信用额度',exact:true})});await expect(card).toBeVisible();
 await page.route('**/help-centre/qa?**',route=>{const source=new URL(route.request().url());source.pathname=base;source.searchParams.set('fixture','qa');source.searchParams.set('collection','1');return route.fulfill({status:302,headers:{location:source.pathname+source.search}});});
 await card.click();await expect(qa.locator('.directory-category-card')).toHaveCount(0);
 const before=page.url(),question=qa.getByRole('button',{name:'0 元签约店铺信用额度如何理解？',exact:true});await question.click();await expect(question).toHaveAttribute('aria-expanded','true');
 await expect(qa.getByText('0 元签约店铺是平台提供的一种签约方式。用户先取得店铺信用额度，再完成店铺签约。',{exact:true})).toBeVisible();expect(page.url()).toBe(before);
 await expect(qa.getByRole('link',{name:'此问题的独立链接'})).toHaveAttribute('href',/\/help-centre\/qa\?question=qa-credit#qa-qa-credit/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`output/verification/section-qa-${info.project.name}.png`,fullPage:true});
});
