import {expect,test} from '@playwright/test';

const imageAssetIds=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555','66666666-6666-4666-8666-666666666666','77777777-7777-4777-8777-777777777777','88888888-8888-4888-8888-888888888888'];

test.beforeEach(async({page})=>{
 for(const id of imageAssetIds)await page.route(`**/api/assets/${id}`,route=>route.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="#e9eef8"/><text x="32" y="190" font-size="28">${id}</text></svg>`}));
 await page.route('**/api/articles/fumadocs-preview/diagram?**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="240" viewBox="0 0 640 240"><rect width="640" height="240" fill="#fff"/><path d="M120 120h400" stroke="#2563eb" stroke-width="4"/><text x="230" y="100" font-size="28">Submit → Review → Done</text></svg>'}));
});

test('published equations and diagrams use the official BlockNote block specs',async({page})=>{
 await page.goto('/design-preview/fumadocs-reader');
 await expect(page.locator('[data-content-type="mathBlock"]')).toBeVisible();
 await expect(page.locator('[data-content-type="diagram"]')).toBeVisible();
});

test('official Fumadocs navigation exposes the real path, adjacent page and mobile page outline',async({page})=>{
 await page.goto('/design-preview/fumadocs-reader');
 await expect(page.locator('article').getByText('资料目录',{exact:true})).toBeVisible();
 const breadcrumb=page.locator('article').locator('nav, div').filter({hasText:'账户管理'}).first();
 await expect(breadcrumb).toContainText('账户管理');
 await expect(breadcrumb).toContainText('如何修改账户邮箱');
 await expect(page.getByRole('link',{name:/如何找回密码.*下一页/})).toHaveAttribute('href','/design-preview/fumadocs-reader/example-password');
 if((page.viewportSize()?.width??1440)<1280){
  await expect(page.locator('[data-toc-popover-trigger]')).toBeVisible();
  await page.locator('[data-toc-popover-trigger]').click();
  await expect(page.locator('[data-toc-popover-content]').getByRole('link',{name:'修改账户邮箱流程',exact:true})).toBeVisible();
 }else{
  await expect(page.locator('#nd-toc').getByRole('link',{name:'修改账户邮箱流程',exact:true})).toBeVisible();
 }
});

test('legacy validation links redirect to the canonical per-article path',async({page})=>{
 await page.goto('/design-preview/fumadocs-reader?article=legacy%20article&lang=en');
 await expect(page).toHaveURL(/\/design-preview\/fumadocs-reader\/legacy%20article$/);
});

test('directory and unavailable states use the official Fumadocs shell',async({page})=>{
 await page.goto('/design-preview/fumadocs-reader?fixture=directory');
 const directory=page.locator('[data-fumadocs-directory-state]');
 await expect(directory).toBeVisible();
 await expect(directory.getByRole('heading',{name:'欢迎使用资料库'})).toBeVisible();
 if((page.viewportSize()?.width??1440)<1280){
  await page.getByRole('button',{name:'开启侧边栏'}).click();
 }
 const directoryAccountFolder=page.getByRole('button',{name:'账户管理'});
 if(await directoryAccountFolder.getAttribute('aria-expanded')==='false')await directoryAccountFolder.click();
 await expect(page.getByRole('link',{name:'如何修改账户邮箱'})).toHaveAttribute('href','/help-centre/articles/fumadocs-preview');
 await expect(page.locator('.entry-frame')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);

 await page.goto('/design-preview/fumadocs-reader?fixture=directory-error');
 await expect(page.locator('[data-fumadocs-directory-state]').getByRole('heading',{name:'目录暂时无法加载'})).toBeVisible();
 await expect(page.getByRole('link',{name:'重新加载'})).toHaveAttribute('href','/design-preview/fumadocs-reader?fixture=directory-error');
});

test('Help Centre home retains every JUYU entry inside the official Fumadocs home layout',async({page},info)=>{
 const requestedTags:string[]=[];
 await page.route('**/api/fumadocs-search?**',async route=>{
  const tag=new URL(route.request().url()).searchParams.get('tag')??'all';
  requestedTags.push(tag);
  await new Promise(resolve=>setTimeout(resolve,350));
  const results=tag==='qa'?
   [
    {id:'qa-credit',type:'page',url:'/help-centre/qa?question=credit',content:'什么是 0 元签约店铺？',title:'什么是 0 元签约店铺？',snippet:'了解签约店铺和信用额度的使用规则。',kind:'qa',breadcrumbs:['Q&A 问答'],total:1},
   ]:
   [
    {id:'qa-credit',type:'page',url:'/help-centre/qa?question=credit',content:'什么是 0 元签约店铺？',title:'什么是 0 元签约店铺？',snippet:'了解签约店铺和信用额度的使用规则。',kind:'qa',breadcrumbs:['Q&A 问答'],total:2},
    {id:'article-credit',type:'page',url:'/help-centre/articles/credit-article',content:'如何申请信用额度？',title:'如何申请信用额度？',snippet:'提交申请前需要准备账户和店铺资料。',kind:'article',breadcrumbs:['知识文章'],total:2},
   ];
  return route.fulfill({json:results});
 });
 await page.emulateMedia({colorScheme:'light'});
 await page.goto('/design-preview/fumadocs-reader?fixture=home');
 const home=page.locator('[data-fumadocs-home-page]');
 await expect(home).toBeVisible();
 await expect(home.getByRole('heading',{name:'今天需要找什么答案？',level:1})).toBeVisible();
 const answerAccent=home.getByRole('heading',{name:'今天需要找什么答案？',level:1}).locator('span');
 const accentColor=await answerAccent.evaluate(element=>getComputedStyle(element).color);
 expect(accentColor).toBe('rgb(179, 19, 27)');
 const brand=page.locator('#nd-nav .juyu-home-brand');
 await expect(brand.locator('strong')).toHaveText('JUYU');
 await expect(brand.locator('span')).toHaveText('Help Centre');
 await expect(page.locator('#nd-nav [data-search-full]')).toHaveCount(0);
 const mobile=(page.viewportSize()?.width??1440)<1280;
 const mobileMenu=page.getByRole('button',{name:'Toggle Menu'});
 if(mobile)await mobileMenu.click();
 const themeSwitch=page.locator('button[data-theme-toggle]:visible');
 await expect(themeSwitch).toHaveCount(1);
 await themeSwitch.click();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.classList.contains('dark'))).toBe(true);
 const darkColors=await home.getByRole('heading',{name:'今天需要找什么答案？'}).evaluate(element=>({text:getComputedStyle(element).color,background:getComputedStyle(document.body).backgroundColor}));
 expect(darkColors.text).not.toBe('rgb(0, 0, 0)');
 expect(darkColors.text).not.toBe(darkColors.background);
 await page.screenshot({path:`output/verification/fumadocs-home-${info.project.name}-dark.png`,fullPage:true});
 await page.keyboard.press('d');
 await expect.poll(()=>page.evaluate(()=>document.documentElement.classList.contains('dark'))).toBe(false);
 if(mobile)await page.keyboard.press('Escape');
 const tabs=home.locator('.home-section-tabs');
 await expect(tabs).toBeVisible();
 await expect(tabs.getByRole('link',{name:'知识文章'})).toHaveAttribute('aria-current','page');
 await expect(home.locator('.home-featured')).toBeVisible();
 await expect(home.locator('.home-document-number')).toHaveCount(3);
 await expect(home.locator('.home-side .home-updates')).toBeVisible();
 await expect(home.locator('.home-side .home-recent')).toBeVisible();
 const searchTrigger=home.locator('.home-search [data-search-full]');
 await expect(searchTrigger).toBeVisible();
 await searchTrigger.click();
 const dialog=page.getByRole('dialog');
 const searchInput=dialog.getByPlaceholder('搜索');
 await searchInput.fill('信用额度');
 await expect(dialog.getByRole('status')).toHaveText('正在搜索…');
 await expect(dialog.getByText('什么是 0 元签约店铺？',{exact:true})).toBeVisible();
 await expect(dialog.locator('button[aria-selected]')).toHaveCount(2);
 await expect(dialog.getByText('了解签约店铺和信用额度的使用规则。',{exact:true})).toBeVisible();
 await expect(dialog.getByText('如何申请信用额度？',{exact:true})).toBeVisible();
 await expect(dialog.getByRole('link',{name:/查看全部结果/})).toHaveAttribute('href','/help-centre?q=%E4%BF%A1%E7%94%A8%E9%A2%9D%E5%BA%A6');
 await page.locator('button[data-active]').filter({hasText:'Q&A 问答'}).click();
 await expect(dialog.getByRole('status')).toHaveText('正在搜索…');
 await expect(dialog.getByText('如何申请信用额度？',{exact:true})).toHaveCount(0);
 await expect(dialog.locator('button[aria-selected]')).toHaveCount(1);
 expect(requestedTags).toContain('all');
 expect(requestedTags).toContain('qa');
 await dialog.getByRole('button',{name:'关闭搜索'}).click();
 await expect(home.getByRole('link',{name:'知识文章',exact:true})).toHaveAttribute('href','/help-centre/library');
 await expect(home.getByRole('link',{name:'OPS Internal',exact:true})).toHaveAttribute('href','/help-centre/ops');
 await expect(home.getByRole('link',{name:'Reference 速查',exact:true})).toHaveAttribute('href','/help-centre/reference');
 await expect(home.getByRole('link',{name:'Q&A 问答',exact:true})).toHaveAttribute('href','/help-centre/qa');
 await expect(home.getByRole('link',{name:/普通会员权益说明 已发布 · 正式资料/})).toHaveAttribute('href','/help-centre/articles/fumadocs-preview');
 await expect(home.getByText('正式版本 1',{exact:true})).toBeVisible();
 await expect(page.locator('.entry-frame')).toHaveCount(0);
 await expect(page.locator('.knowledge-sidebar')).toHaveCount(0);
 await page.screenshot({path:`output/verification/fumadocs-home-${info.project.name}-light.png`,fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('full search results retain JUYU result behavior inside the official Fumadocs shell',async({page})=>{
 await page.emulateMedia({colorScheme:'dark'});
 await page.goto('/design-preview/fumadocs-reader?fixture=search');
 const search=page.locator('[data-fumadocs-search-page]');
 await expect(search).toBeVisible();
 await expect(search.getByRole('heading',{name:'搜索结果',level:1})).toBeVisible();
 await expect(search.getByRole('status')).toContainText('“信用” · 找到 2 项结果');
 await expect(search.getByRole('link',{name:'查看答案：0 元签约店铺信用额度如何理解？'})).toHaveAttribute('href','/help-centre/qa?question=credit');
 await expect(search.getByRole('link',{name:'阅读：如何申请信用额度？'})).toHaveAttribute('href','/help-centre/articles/credit-article');
 await expect(search.getByText('Q&A 问答',{exact:true})).toBeVisible();
 await expect(search.getByText('知识文章',{exact:true})).toBeVisible();
 if((page.viewportSize()?.width??1440)<1280){
  await page.getByRole('button',{name:'开启侧边栏'}).click();
 }
 const searchAccountFolder=page.getByRole('button',{name:'账户管理'});
 if(await searchAccountFolder.getAttribute('aria-expanded')==='false')await searchAccountFolder.click();
 await expect(page.getByRole('link',{name:'如何修改账户邮箱'})).toHaveAttribute('href','/help-centre/articles/fumadocs-preview');
 await expect(page.locator('.entry-frame')).toHaveCount(0);
 await expect(page.locator('.knowledge-sidebar')).toHaveCount(0);
 const colors=await search.getByRole('heading',{name:'如何申请信用额度？'}).evaluate(element=>({text:getComputedStyle(element).color,background:getComputedStyle(document.body).backgroundColor}));
 expect(colors.text).not.toBe('rgb(0, 0, 0)');
 expect(colors.text).not.toBe(colors.background);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('OPS list retains its protected collection behavior inside the official Fumadocs shell',async({page},info)=>{
 await page.emulateMedia({colorScheme:'dark'});
 await page.goto('/design-preview/fumadocs-reader?fixture=ops');
 const ops=page.locator('[data-fumadocs-ops-page]');
 await expect(ops).toBeVisible();
 await expect(ops.getByRole('heading',{name:'OPS Internal',level:1})).toBeVisible();
 await expect(ops.getByRole('status')).toContainText('共 2 篇 · 第 1 / 1 页 · 本页 2 篇');
 await expect(ops.getByRole('link',{name:'阅读：运营异常处理'})).toHaveAttribute('href','/help-centre/articles/ops-procedure');
 await expect(ops.getByText('内部流程 · 正式资料',{exact:true})).toBeVisible();
 if((page.viewportSize()?.width??1440)<1280){
  await page.getByRole('button',{name:'开启侧边栏'}).click();
 }
 await expect(page.getByRole('link',{name:'运营异常处理',exact:true})).toHaveAttribute('href','/help-centre/articles/ops-procedure');
 await expect(page.locator('.entry-frame')).toHaveCount(0);
 await expect(page.locator('.knowledge-sidebar')).toHaveCount(0);
 const colors=await ops.getByRole('heading',{name:'运营异常处理'}).evaluate(element=>({text:getComputedStyle(element).color,background:getComputedStyle(document.body).backgroundColor}));
 expect(colors.text).not.toBe('rgb(0, 0, 0)');
 expect(colors.text).not.toBe(colors.background);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`output/verification/fumadocs-ops-${info.project.name}.png`,fullPage:true});
});

test('Reference keeps its selector and read-only table inside the official Fumadocs shell',async({page},info)=>{
 await page.emulateMedia({colorScheme:'dark'});
 await page.goto('/design-preview/fumadocs-reader?fixture=reference');
 const reference=page.locator('[data-fumadocs-reference-page]');
 await expect(reference).toBeVisible();
 await expect(reference.getByRole('heading',{name:'Reference 速查',level:1})).toBeVisible();
 await expect(reference.getByRole('status').first()).toContainText('共 2 份速查资料');
 await expect(reference.getByRole('link',{name:'打开速查：域名费用速查'})).toHaveAttribute('aria-current','page');
 await expect(reference.getByRole('heading',{name:'域名费用速查',level:2})).toBeVisible();
 const table=reference.getByRole('region',{name:'速查表 1',exact:true});
 await expect(table.getByRole('status')).toContainText('共 2 行 · 符合 2 行');
 await table.getByRole('textbox',{name:'筛选表格'}).fill('续费');
 await expect(table.getByRole('status')).toContainText('符合 1 行');
 await expect(table.getByRole('cell',{name:'到期前完成续费'})).toBeVisible();
 await expect(reference.getByRole('link',{name:'编辑此资料'})).toHaveCount(0);
 await expect(page.locator('.entry-frame')).toHaveCount(0);
 await expect(page.locator('.knowledge-sidebar')).toHaveCount(0);
 const colors=await reference.getByRole('heading',{name:'域名费用速查'}).evaluate(element=>({text:getComputedStyle(element).color,background:getComputedStyle(document.body).backgroundColor}));
 expect(colors.text).not.toBe('rgb(0, 0, 0)');
 expect(colors.text).not.toBe(colors.background);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`output/verification/fumadocs-reference-${info.project.name}.png`,fullPage:true});
});

test('Q&A keeps its search and topic filters inside the official Fumadocs shell',async({page},info)=>{
 await page.emulateMedia({colorScheme:'dark'});
 await page.goto('/design-preview/fumadocs-reader?fixture=qa');
 const qa=page.locator('[data-fumadocs-qa-page]');
 await expect(qa).toBeVisible();
 await expect(qa.getByRole('heading',{name:'Q&A 问答',level:1})).toBeVisible();
 await expect(qa.getByRole('searchbox',{name:'搜索问题或答案'})).toBeVisible();
 const searchButton=qa.getByRole('button',{name:'搜索问答'});
 await expect(searchButton).toBeVisible();
 await expect(qa.getByRole('navigation',{name:'问答分类'}).getByRole('link',{name:'信用额度'})).toBeVisible();
 await expect(qa.getByRole('navigation',{name:'相关话题'}).getByRole('link',{name:'签约店铺'})).toBeVisible();
 await expect(qa.getByRole('heading',{name:'暂时没有找到相关答案'})).toBeVisible();
 await expect(page.locator('.entry-frame')).toHaveCount(0);
 await expect(page.locator('.knowledge-sidebar')).toHaveCount(0);
 const colors=await qa.getByRole('heading',{name:'暂时没有找到相关答案'}).evaluate(element=>({text:getComputedStyle(element).color,background:getComputedStyle(document.body).backgroundColor}));
 expect(colors.text).not.toBe('rgb(0, 0, 0)');
 expect(colors.text).not.toBe(colors.background);
 const buttonColors=await searchButton.evaluate(element=>({text:getComputedStyle(element).color,background:getComputedStyle(element).backgroundColor}));
 expect(buttonColors.text).not.toBe(buttonColors.background);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`output/verification/fumadocs-qa-${info.project.name}.png`,fullPage:true});
});

test('saved articles use official Fumadocs cards and direct content links',async({page},info)=>{
 await page.emulateMedia({colorScheme:'dark'});
 await page.goto('/design-preview/fumadocs-reader?fixture=favorites');
 const favorites=page.locator('[data-fumadocs-favorites-page]');
 await expect(favorites).toBeVisible();
 await expect(favorites.getByRole('heading',{name:'我的收藏',level:1})).toBeVisible();
 await expect(favorites.getByRole('status')).toContainText('共 2 篇可阅读的收藏');
 await expect(favorites.getByRole('link',{name:'阅读收藏：如何修改账户邮箱'})).toHaveAttribute('href','/help-centre/articles/favorite-account');
 await expect(favorites.getByRole('link',{name:'阅读收藏：0 元签约店铺信用额度如何理解？'})).toHaveAttribute('href','/help-centre/qa?question=favorite-credit#qa-favorite-credit');
 await expect(favorites.locator('[data-card]')).toHaveCount(2);
 await expect(page.locator('.entry-frame')).toHaveCount(0);
 await expect(page.locator('.knowledge-sidebar')).toHaveCount(0);
 const colors=await favorites.getByText('如何修改账户邮箱',{exact:true}).evaluate(element=>({text:getComputedStyle(element).color,background:getComputedStyle(document.body).backgroundColor}));
 expect(colors.text).not.toBe('rgb(0, 0, 0)');
 expect(colors.text).not.toBe(colors.background);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`output/verification/fumadocs-favorites-${info.project.name}.png`,fullPage:true});
});

test('recently viewed uses official Fumadocs cards while preserving update and time metadata',async({page},info)=>{
 await page.emulateMedia({colorScheme:'dark'});
 await page.goto('/design-preview/fumadocs-reader?fixture=recent');
 const recent=page.locator('[data-fumadocs-recent-page]');
 await expect(recent).toBeVisible();
 await expect(recent.getByRole('heading',{name:'最近浏览',level:1})).toBeVisible();
 await expect(recent.getByRole('status')).toContainText('共 2 篇可阅读的资料');
 await expect(recent.getByRole('link',{name:'再次阅读：如何修改账户邮箱'})).toHaveAttribute('href','/help-centre/articles/recent-account');
 await expect(recent.getByRole('link',{name:'再次阅读：0 元签约店铺信用额度如何理解？'})).toHaveAttribute('href','/help-centre/qa?question=recent-credit#qa-recent-credit');
 await expect(recent.getByText(/上次阅读后有更新/)).toBeVisible();
 await expect(recent.locator('time').last()).toHaveAttribute('datetime','2026-09-25T02:00:00.000Z');
 await expect(recent.locator('time').last()).toContainText('10:00');
 await expect(recent.locator('[data-card]')).toHaveCount(2);
 await expect(page.locator('.entry-frame')).toHaveCount(0);
 await expect(page.locator('.knowledge-sidebar')).toHaveCount(0);
 const colors=await recent.getByText('如何修改账户邮箱',{exact:true}).evaluate(element=>({text:getComputedStyle(element).color,background:getComputedStyle(document.body).backgroundColor}));
 expect(colors.text).not.toBe('rgb(0, 0, 0)');
 expect(colors.text).not.toBe(colors.background);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`output/verification/fumadocs-recent-${info.project.name}.png`,fullPage:true});
});

test('internal forms use official Fumadocs cards and retain direct fill links',async({page},info)=>{
 await page.emulateMedia({colorScheme:'dark'});
 await page.goto('/design-preview/fumadocs-reader?fixture=forms');
 const forms=page.locator('[data-fumadocs-forms-page]');
 await expect(forms).toBeVisible();
 await expect(forms.getByRole('heading',{name:'内部表单',level:1})).toBeVisible();
 await expect(forms.getByRole('link',{name:'填写表单：账户资料变更申请'})).toHaveAttribute('href','/help-centre/forms/00000000-0000-4000-8000-000000000010');
 await expect(forms.getByRole('link',{name:'填写表单：异常处理申请'})).toHaveAttribute('href','/help-centre/forms/00000000-0000-4000-8000-000000000012');
 await expect(forms.locator('[data-card]')).toHaveCount(2);
 await expect(forms.getByText('1 个填写项 · 打开表单',{exact:true})).toBeVisible();
 await expect(forms.getByText('2 个填写项 · 打开表单',{exact:true})).toBeVisible();
 await expect(page.locator('.entry-frame')).toHaveCount(0);
 await expect(page.locator('.knowledge-sidebar')).toHaveCount(0);
 const colors=await forms.getByText('账户资料变更申请',{exact:true}).evaluate(element=>({text:getComputedStyle(element).color,background:getComputedStyle(document.body).backgroundColor}));
 expect(colors.text).not.toBe('rgb(0, 0, 0)');
 expect(colors.text).not.toBe(colors.background);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`output/verification/fumadocs-forms-${info.project.name}.png`,fullPage:true});
});

test('form fill keeps the protected workflow inside the official Fumadocs shell',async({page},info)=>{
 await page.emulateMedia({colorScheme:'dark'});
 await page.goto('/design-preview/fumadocs-reader?fixture=form-fill');
 const fill=page.locator('[data-fumadocs-form-fill-page]');
 await expect(fill).toBeVisible();
 await expect(fill.getByRole('heading',{name:'异常处理申请',level:1})).toBeVisible();
 await expect(fill.getByText('说明遇到的情况，并提交给管理员跟进。',{exact:true})).toBeVisible();
 await expect(fill.getByRole('textbox',{name:'问题说明 *'})).toBeVisible();
 await expect(fill.getByRole('combobox',{name:'需要升级'})).toBeVisible();
 await expect(fill.getByRole('button',{name:'提交表单'})).toBeVisible();
 await expect(fill.getByRole('button',{name:'保留输入并载入最新版'})).toBeVisible();
 const mobile=(page.viewportSize()?.width??1440)<1280;
 if(!mobile)await expect(page.getByRole('link',{name:'异常处理申请',exact:true}).first()).toHaveAttribute('href','/help-centre/forms/00000000-0000-4000-8000-000000000012');
 await expect(page.locator('.entry-frame')).toHaveCount(0);
 await expect(page.locator('.knowledge-sidebar')).toHaveCount(0);
 const colors=await fill.getByRole('heading',{name:'异常处理申请',level:1}).evaluate(element=>({text:getComputedStyle(element).color,background:getComputedStyle(document.body).backgroundColor}));
 expect(colors.text).not.toBe('rgb(0, 0, 0)');
 expect(colors.text).not.toBe(colors.background);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`output/verification/fumadocs-form-fill-${info.project.name}.png`,fullPage:true});
});

test('changelog uses official Fumadocs cards and keeps publication metadata and paging',async({page},info)=>{
 await page.emulateMedia({colorScheme:'dark'});
 await page.goto('/design-preview/fumadocs-reader?fixture=changelog');
 const changelog=page.locator('[data-fumadocs-changelog-page]');
 await expect(changelog).toBeVisible();
 await expect(changelog.getByRole('heading',{name:'更新日志',level:1})).toBeVisible();
 await expect(changelog.getByText('按正式发布时间排列当前可阅读的资料。仅显示你有权限查看的已发布版本。',{exact:true})).toBeVisible();
 await expect(changelog.getByRole('link',{name:/如何修改账户邮箱/})).toHaveAttribute('href','/help-centre/articles/update-account');
 await expect(changelog.getByRole('link',{name:/0 元签约店铺信用额度如何理解？/})).toHaveAttribute('href','/help-centre/qa?question=update-credit#qa-update-credit');
 await expect(changelog.getByText(/知识文章 · 正式版本 2/)).toBeVisible();
 await expect(changelog.getByText(/Q&A · 正式版本 1/)).toBeVisible();
 await expect(changelog.getByText('第二版：补充无法登录时的处理步骤。\n同步更新所需验证资料。',{exact:true})).toBeVisible();
 await expect(changelog.locator('[data-card]')).toHaveCount(2);
 await expect(changelog.getByRole('navigation',{name:'更新日志分页'}).getByRole('link',{name:'上一页'})).toHaveAttribute('href','/help-centre/changelog');
 await expect(changelog.getByRole('navigation',{name:'更新日志分页'}).getByRole('link',{name:'下一页'})).toHaveAttribute('href','/help-centre/changelog?page=3');
 await expect(page.locator('.entry-frame')).toHaveCount(0);
 await expect(page.locator('.knowledge-sidebar')).toHaveCount(0);
 const colors=await changelog.getByRole('heading',{name:'更新日志',level:1}).evaluate(element=>({text:getComputedStyle(element).color,background:getComputedStyle(document.body).backgroundColor}));
 expect(colors.text).not.toBe('rgb(0, 0, 0)');
 expect(colors.text).not.toBe(colors.background);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`output/verification/fumadocs-changelog-${info.project.name}.png`,fullPage:true});
});

test('PDF screen uses the official Fumadocs shell and print keeps only the protected document',async({page},info)=>{
 await page.emulateMedia({colorScheme:'dark'});
 await page.goto('/design-preview/fumadocs-reader?fixture=pdf');
 const pdf=page.locator('[data-fumadocs-pdf-page]');
 await expect(pdf).toBeVisible();
 await expect(pdf.getByRole('heading',{name:'PDF 阅读／导出',level:1})).toBeVisible();
 await expect(pdf.getByText('PDF 阅读 · 正式资料示例 · 正式版本 1',{exact:true})).toBeVisible();
 await expect(pdf.getByRole('link',{name:'← 返回文章'})).toHaveAttribute('href','/help-centre/articles/fumadocs-preview');
 await expect(pdf.getByRole('button',{name:'下载 PDF'})).toBeVisible();
 await expect(pdf.getByRole('button',{name:'打印此页'})).toBeVisible();
 await expect(pdf.getByRole('article',{name:'PDF 正文'})).toBeVisible();
 await expect(pdf.getByRole('heading',{name:'PDF 阅读 · 正式资料示例'})).toBeVisible();
 await expect(pdf.getByRole('columnheader',{name:'项目'})).toBeVisible();
 expect(await page.locator('.fumadocs-sidebar-account').count()).toBeGreaterThan(0);
 if(info.project.name==='desktop'){
  const sidebarAccount=page.locator('#nd-sidebar .fumadocs-sidebar-account');
  await expect(sidebarAccount).toBeVisible();
  await sidebarAccount.locator('.account-menu>summary').click();
  const accountPopover=sidebarAccount.locator('.account-menu>div');
  await expect(accountPopover).toBeVisible();
  const popoverBounds=await accountPopover.boundingBox();
  const viewport=page.viewportSize();
  expect(popoverBounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(popoverBounds!.y).toBeGreaterThanOrEqual(0);
  expect(popoverBounds!.y+popoverBounds!.height).toBeLessThanOrEqual(viewport!.height);
  await sidebarAccount.locator('.account-menu>summary').click();
 }
 await expect(page.locator('#nd-sidebar .fumadocs-nav-account')).toHaveCount(0);
 await expect(page.locator('.entry-frame')).toHaveCount(0);
 await expect(page.locator('.knowledge-sidebar')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`output/verification/fumadocs-pdf-${info.project.name}.png`,fullPage:true});
 await page.emulateMedia({media:'print'});
 await expect(page.locator('.fumadocs-pdf-screen-heading')).toBeHidden();
 await expect(page.locator('.pdf-controls')).toBeHidden();
 await expect(pdf.getByRole('article',{name:'PDF 正文'})).toBeVisible();
 if(await page.locator('#nd-sidebar').count())await expect(page.locator('#nd-sidebar')).toBeHidden();
 if(await page.locator('#nd-subnav').count())await expect(page.locator('#nd-subnav')).toBeHidden();
});

test('the plain article fixture uses Fumadocs without inventing an on-page outline',async({page})=>{
 await page.goto('/design-preview/fumadocs-reader?fixture=plain');
 await expect(page.getByRole('heading',{name:'没有章节标题的文章',level:1})).toBeVisible();
 await expect(page.getByText('这是没有章节标题的文章示例，用于检查正文宽度和换行。',{exact:true})).toBeVisible();
 await expect(page.locator('#nd-toc a')).toHaveCount(0);
});

test('old article preview links land on their matching Fumadocs fixture',async({page})=>{
 await page.goto('/design-preview/article');
 await expect(page).toHaveURL(/\/design-preview\/fumadocs-reader$/);
 await page.goto('/design-preview/article-email');
 await expect(page).toHaveURL(/\/design-preview\/fumadocs-reader$/);
 await page.goto('/design-preview/article-plain');
 await expect(page).toHaveURL(/\/design-preview\/fumadocs-reader\?fixture=plain$/);
});

test('article cards expose only server-authorized references inside the Fumadocs reader',async({page})=>{
 await page.goto('/design-preview/fumadocs-reader');
 const allowed=page.locator('[data-fumadocs-article-reference="email-reference"]');
 await expect(allowed.locator('[data-card]')).toBeVisible();
 await expect(allowed.getByRole('heading',{name:'账户安全检查清单'})).toBeVisible();
 await expect(allowed.getByText('核对身份、邮箱和登录验证状态。',{exact:true})).toBeVisible();
 await expect(allowed.getByRole('link',{name:/账户安全检查清单/})).toHaveAttribute('href','/design-preview/fumadocs-reader/account-security-checklist');
 const unavailable=page.locator('[data-fumadocs-article-reference="email-restricted-reference"]');
 await expect(unavailable.getByText('引用的资料目前无法阅读。',{exact:true})).toBeVisible();
 await expect(unavailable.locator('a')).toHaveCount(0);
 await expect(page.getByText('restricted-account-guide')).toHaveCount(0);
});

test('article action buttons use official Fumadocs variants and preserve safe link behavior',async({page})=>{
 await page.goto('/design-preview/fumadocs-reader');
 const primary=page.locator('[data-fumadocs-action-button="email-primary-button"]');
 await expect(primary).toHaveText('打开账户中心');
 await expect(primary).toHaveAttribute('href','https://example.com/account');
 await expect(primary).toHaveAttribute('target','_blank');
 await expect(primary).toHaveAttribute('rel','noopener noreferrer');
 await expect(primary).toHaveClass(/bg-fd-primary/);
 const secondary=page.locator('[data-fumadocs-action-button="email-secondary-button"]');
 await expect(secondary).toHaveText('查看内部表单');
 await expect(secondary).toHaveAttribute('href','/help-centre/forms');
 await expect(secondary).not.toHaveAttribute('target','_blank');
 await expect(secondary).toHaveClass(/bg-fd-secondary/);
});

test('external content connects to approved providers only after the reader chooses to load it',async({page})=>{
 await page.route('https://www.youtube-nocookie.com/embed/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Video</title>'}));
 await page.goto('/design-preview/fumadocs-reader');
 const youtube=page.locator('[data-fumadocs-external-embed="email-youtube-embed"]');
 await expect(youtube.getByText('YouTube 内容',{exact:true})).toBeVisible();
 await expect(youtube.getByText('邮箱修改操作影片',{exact:true})).toBeVisible();
 await expect(youtube.locator('iframe')).toHaveCount(0);
 const load=youtube.getByRole('button',{name:'加载外部内容'});
 await expect(load).toHaveClass(/border/);
 await load.click();
 const frame=youtube.locator('iframe');
 await expect(frame).toHaveAttribute('src','https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
 await expect(frame).toHaveAttribute('sandbox','allow-scripts allow-same-origin allow-presentation allow-popups');
 await expect(frame).toHaveAttribute('referrerpolicy','no-referrer');
 const fallback=page.locator('[data-fumadocs-external-embed="email-external-link"]');
 await expect(fallback.locator('iframe')).toHaveCount(0);
 await expect(fallback.getByText('账户操作补充说明',{exact:true})).toBeVisible();
 const website=fallback.getByRole('link',{name:'打开外部网站'});
 await expect(website).toHaveAttribute('href','https://example.com/account-guide');
 await expect(website).toHaveAttribute('target','_blank');
 await expect(website).toHaveAttribute('rel','noopener noreferrer');
});

test('official Fumadocs shell renders the same BlockNote document read only',async({page},info)=>{
 await page.goto('/design-preview/fumadocs-reader');
 await expect(page.getByRole('heading',{name:'如何修改账户邮箱',level:1})).toBeVisible();
 await expect(page.locator('article').filter({has:page.locator('.prose')})).toBeVisible();
 await expect(page.locator('[data-fumadocs-blocknote-reader].not-prose').first()).toBeVisible();
 const readOnlyEditor=page.locator('.bn-editor[contenteditable="false"]').first();
 await expect(readOnlyEditor).toBeVisible();
 const readerSurface=await readOnlyEditor.evaluate(element=>{
  const style=getComputedStyle(element);
  return {background:style.backgroundColor,paddingInline:style.paddingInline,borderRadius:style.borderRadius};
 });
 expect(readerSurface).toEqual({background:'rgba(0, 0, 0, 0)',paddingInline:'0px',borderRadius:'0px'});
 if(info.project.name==='desktop'){
  await expect(page.getByRole('button',{name:'账户管理'})).toHaveAttribute('aria-expanded','true');
  await expect(page.getByRole('button',{name:'交易与订单'})).toHaveAttribute('aria-expanded','false');
 }
 await expect(page.getByRole('heading',{name:'修改账户邮箱流程'})).toBeVisible();
 await expect(page.getByText('请先准备账户验证资料。',{exact:true})).toBeVisible();
 const inlineLink=page.locator('[data-fumadocs-inline-link]').filter({hasText:'账户安全规则'});
 await expect(inlineLink).toHaveAttribute('href','https://example.com/security');
 await expect(inlineLink).toHaveAttribute('target','_blank');
 await expect(inlineLink).toHaveAttribute('rel','noreferrer noopener');
 await expect(page.locator('[data-fumadocs-inline-icon]')).toHaveAttribute('aria-label','安全图标');
 const inlineMath=page.locator('[data-fumadocs-inline-math]');
 await expect(inlineMath).toHaveAttribute('aria-label','x^2+y^2=z^2');
 await expect(inlineMath.locator('math')).toBeVisible();
 const inlineImage=page.locator('[data-fumadocs-inline-image]');
 await expect(inlineImage).toHaveAttribute('src','/api/assets/88888888-8888-4888-8888-888888888888');
 await expect(inlineImage).toHaveAttribute('alt','账户验证截图');
 await expect(inlineImage).toHaveCSS('display','inline-block');
 await expect(page.locator('[data-rmiz]').filter({has:inlineImage})).toBeVisible();
 const callout=page.locator('[data-fumadocs-callout="email-callout"]');
 await expect(callout.getByText('先核实身份，再查看',{exact:false})).toBeVisible();
 await expect(callout.getByRole('link',{name:'处理规则'})).toHaveAttribute('href','https://example.com/rules');
 const tabs=page.locator('[data-fumadocs-tabs="email-tabs"]');
 await expect(tabs.getByRole('tablist')).toBeVisible();
 await expect(tabs.getByRole('tab',{name:'自行处理',exact:true})).toHaveAttribute('aria-selected','true');
 await expect(tabs.getByText('先打开账户设置，再查看',{exact:false})).toBeVisible();
 await expect(tabs.getByRole('link',{name:'账户操作说明'})).toHaveAttribute('href','https://example.com/account');
 await expect(page.locator('.bn-editor[contenteditable="false"]')).toHaveCount(1);
 await expect(page.locator('[data-fumadocs-blocknote-static]')).toHaveCount(4);
 await tabs.getByRole('tab',{name:'专员协助',exact:true}).click();
 await expect(tabs.getByText('无法登录时，请联系专员核对身份。',{exact:true})).toBeVisible();
 await expect(tabs.getByText('先打开账户设置，再查看',{exact:false})).toBeHidden();
 const steps=page.locator('[data-fumadocs-steps="email-steps"]');
 await expect(steps.locator('.fd-step')).toHaveCount(2);
 await expect(steps.getByRole('heading').allTextContents()).resolves.toEqual(['核对账户资料','提交修改申请']);
 await expect(steps.getByText('准备账户 ID，并确认',{exact:false})).toBeVisible();
 await expect(steps.getByRole('link',{name:'身份资料要求'})).toHaveAttribute('href','https://example.com/identity');
 await expect(steps.getByText('填写新邮箱后提交申请，并等待专员回复。',{exact:true})).toBeVisible();
 const columns=page.locator('[data-fumadocs-columns="email-columns"]');
 await expect(columns.locator(':scope > article')).toHaveCount(3);
 await expect(columns.getByRole('heading').allTextContents()).resolves.toEqual(['需要准备','处理方式','审核结果']);
 await expect(columns.getByText('准备账户 ID、原绑定邮箱，并查看',{exact:false})).toBeVisible();
 await expect(columns.getByRole('link',{name:'完整资料要求'})).toHaveAttribute('href','https://example.com/requirements');
 await expect(columns.getByText('完成资料核对后，通过工单提交修改申请。',{exact:true})).toBeVisible();
 const columnTracks=await columns.evaluate(element=>getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length);
 expect(columnTracks).toBe((page.viewportSize()?.width??1440)<768?1:3);
 const table=page.locator('[data-fumadocs-table="email-table"]');
 await expect(table).toBeVisible();
 await expect(table.getByRole('columnheader',{name:'账户资料'})).toHaveAttribute('colspan','2');
 const mergedCell=table.getByRole('cell',{name:'基本资料'});
 await expect(mergedCell).toHaveAttribute('rowspan','2');
 await expect(mergedCell).toHaveCSS('vertical-align','middle');
 await expect(mergedCell).toHaveCSS('border-right-width','2px');
 await expect(mergedCell).toHaveCSS('border-right-color','rgb(204, 34, 51)');
 await expect(table.getByRole('cell',{name:'账户 ID'})).toHaveCSS('vertical-align','bottom');
 await expect(table.getByRole('columnheader',{name:'账户资料'})).toHaveCSS('border-bottom-width','3px');
 const tableScroll=table.locator('..');
 await expect(tableScroll).toHaveCSS('overflow-x','auto');
 if((page.viewportSize()?.width??1440)<768){
  const metrics=await tableScroll.evaluate(element=>({clientWidth:element.clientWidth,scrollWidth:element.scrollWidth}));
  expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
 }
 const code=page.locator('[data-fumadocs-code="email-code"]');
 await expect(code).toBeVisible();
 await expect(code.getByText('JavaScript',{exact:true})).toBeVisible();
 await expect(code.getByRole('button',{name:'复制文字'})).toBeVisible();
 await expect(code.locator('code')).toContainText('const account = "JUYU";\nconsole.log(account);');
 const advanced=page.locator('[data-fumadocs-advanced-code="email-advanced-code"]');
 await expect(advanced).toHaveAttribute('data-expanded','false');
 await expect(advanced.locator('figcaption')).toHaveText('account.ts · TypeScript');
 await expect(advanced.locator('figure')).toHaveAttribute('data-line-numbers','true');
 await expect(advanced.locator('.line.highlighted')).toHaveCount(1);
 await expect(advanced.locator('.line.diff.add')).toHaveCount(1);
 await expect(advanced.locator('.line.diff.remove')).toHaveCount(1);
 await expect(advanced.getByRole('button',{name:'复制文字'})).toBeVisible();
 const geometry=await advanced.evaluate(element=>({width:element.getBoundingClientRect().width,parentWidth:element.parentElement?.getBoundingClientRect().width??0}));
 expect(geometry.width).toBeGreaterThanOrEqual(geometry.parentWidth-1);
 const collapsedMetrics=await advanced.getByRole('region').evaluate(element=>{const style=getComputedStyle(element),line=element.querySelector<HTMLElement>('.line');return {height:element.clientHeight,paddingTop:parseFloat(style.paddingTop),lineHeight:line?parseFloat(getComputedStyle(line).lineHeight):0};});
 expect(collapsedMetrics.height).toBeLessThanOrEqual(collapsedMetrics.paddingTop+collapsedMetrics.lineHeight*3+1);
 const expand=advanced.getByRole('button',{name:'展开全部 7 行'});
 await expect(expand).toHaveAttribute('aria-expanded','false');
 await expand.click();
 await expect(advanced).toHaveAttribute('data-expanded','true');
 await expect(advanced.getByRole('button',{name:'收起代码'})).toHaveAttribute('aria-expanded','true');
 const expandedMetrics=await advanced.getByRole('region').evaluate(element=>({height:element.clientHeight,scrollHeight:element.scrollHeight}));
 expect(expandedMetrics.height).toBe(expandedMetrics.scrollHeight);
 const nativeImage=page.locator('[data-fumadocs-image="email-native-image"]');
 await expect(nativeImage).toHaveAttribute('data-image-alignment','right');
 await expect(nativeImage.locator('img')).toHaveAttribute('src','/api/assets/11111111-1111-4111-8111-111111111111');
 await expect(nativeImage.getByText('BlockNote 图片：保留 280px 宽度及靠右位置。',{exact:true})).toBeVisible();
 await expect(nativeImage.locator('[data-rmiz]')).toBeVisible();
 await expect(nativeImage.locator('[data-rmiz-btn-zoom]')).toHaveAttribute('aria-label','放大图片: 账户设置截图');
 await nativeImage.locator('img').click();
 const imageDialog=page.locator('dialog[data-rmiz-modal][open]');
 await expect(imageDialog).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.locator('dialog[data-rmiz-modal][open]')).toHaveCount(0);
 const imageGeometry=await nativeImage.evaluate(element=>({width:element.getBoundingClientRect().width,parentWidth:element.parentElement?.getBoundingClientRect().width??0,right:element.getBoundingClientRect().right,parentRight:element.parentElement?.getBoundingClientRect().right??0}));
 expect(imageGeometry.width).toBeCloseTo(Math.min(280,imageGeometry.parentWidth),0);
 expect(imageGeometry.right).toBeCloseTo(imageGeometry.parentRight,0);
 const themedImage=page.locator('[data-fumadocs-image="email-theme-image"]');
 await expect(themedImage.locator('img')).toHaveAttribute('src','/api/assets/22222222-2222-4222-8222-222222222222');
 await expect(themedImage.getByText('深色主题会使用对应图片。',{exact:true})).toBeVisible();
 const video=page.locator('[data-fumadocs-media="email-native-video"]');
 await expect(video).toHaveAttribute('data-media-alignment','center');
 await expect(video.locator('video')).toHaveAttribute('src','/api/assets/44444444-4444-4444-8444-444444444444');
 await expect(video.locator('video')).toHaveAttribute('controls','');
 await expect(video.getByText('BlockNote 影片：保留 360px 宽度及居中位置。',{exact:true})).toBeVisible();
 const videoGeometry=await video.evaluate(element=>({width:element.getBoundingClientRect().width,parentWidth:element.parentElement?.getBoundingClientRect().width??0,left:element.getBoundingClientRect().left,parentLeft:element.parentElement?.getBoundingClientRect().left??0}));
 expect(videoGeometry.width).toBeCloseTo(Math.min(360,videoGeometry.parentWidth),0);
 expect(videoGeometry.left-videoGeometry.parentLeft).toBeCloseTo((videoGeometry.parentWidth-videoGeometry.width)/2,0);
 const audio=page.locator('[data-fumadocs-media="email-native-audio"]');
 await expect(audio.locator('audio')).toHaveAttribute('src','/api/assets/55555555-5555-4555-8555-555555555555');
 await expect(audio.getByText('邮箱修改语音说明',{exact:true})).toBeVisible();
 const file=page.locator('[data-fumadocs-media="email-native-file"]');
 await expect(file.getByText('邮箱修改申请表.pdf',{exact:true})).toBeVisible();
 await expect(file.getByRole('link',{name:/邮箱修改申请表\.pdf/})).toHaveAttribute('href','/api/assets/66666666-6666-4666-8666-666666666666');
 const advancedFile=page.locator('[data-fumadocs-media="email-advanced-file"]');
 await expect(advancedFile.getByText('身份资料清单.pdf',{exact:true})).toBeVisible();
 await expect(advancedFile.getByText('高级附件也使用同一套文件显示。',{exact:true})).toBeVisible();
 const math=page.locator('[data-content-type="mathBlock"]');
 await expect(math.locator('math')).toBeVisible();
 await expect(page.getByText('账户验证计算公式',{exact:true})).toBeVisible();
 const diagram=page.locator('[data-content-type="diagram"]');
 await expect(diagram.getByRole('img',{name:'Mermaid 图表'})).toBeVisible();
 await expect(page.getByText('邮箱修改审核流程',{exact:true})).toBeVisible();
 await expect(page.getByText('Unsupported custom block')).toHaveCount(0);
 const mobile=(page.viewportSize()?.width??1440)<1280;
 if(mobile)await page.getByRole('button',{name:/如何修改账户邮箱/}).click();
 else await expect(page.getByRole('heading',{name:'本页目录'})).toBeVisible();
 await page.getByRole('link',{name:'修改账户邮箱流程',exact:true}).click();
 await expect(page).toHaveURL(/#email-process$/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.evaluate(()=>scrollTo(0,0));
 await page.screenshot({path:`output/verification/fumadocs-article-integrated-${info.project.name}.png`,fullPage:true,animations:'disabled'});
});

test('published neutral black text remains readable in the official dark theme',async({page})=>{
 await page.emulateMedia({colorScheme:'dark'});
 await page.goto('/design-preview/fumadocs-reader');
 const paragraph=page.getByText('账户邮箱是登录本站的重要凭证。修改前请先完成身份核对，并确认新邮箱可以正常收信。',{exact:true});
 await expect(paragraph).toBeVisible();
 const colors=await paragraph.evaluate(element=>({text:getComputedStyle(element).color,background:getComputedStyle(document.body).backgroundColor}));
 expect(colors.text).not.toBe('rgb(0, 0, 0)');
 expect(colors.text).not.toBe(colors.background);
 const inlineColors=await page.locator('[data-fumadocs-inline-math]').evaluate(element=>({text:getComputedStyle(element).color,background:getComputedStyle(document.body).backgroundColor}));
 expect(inlineColors.text).not.toBe('rgb(0, 0, 0)');
 expect(inlineColors.text).not.toBe(inlineColors.background);
 await expect(page.locator('[data-fumadocs-inline-image]')).toBeVisible();
 await expect(page.locator('[data-fumadocs-image="email-theme-image"] img')).toHaveAttribute('src','/api/assets/33333333-3333-4333-8333-333333333333');
 const mathColors=await page.locator('[data-content-type="mathBlock"]').evaluate(element=>({text:getComputedStyle(element).color,background:getComputedStyle(element).backgroundColor}));
 expect(mathColors.text).not.toBe('rgb(0, 0, 0)');
 expect(mathColors.text).not.toBe(mathColors.background);
 const advancedCellColors=await page.locator('[data-fumadocs-advanced-table="email-advanced-grid"] .reader-data-table-grid tbody td').first().evaluate(element=>({text:getComputedStyle(element).color,background:getComputedStyle(element).backgroundColor}));
 expect(advancedCellColors.text).not.toBe('rgb(0, 0, 0)');
 expect(advancedCellColors.text).not.toBe(advancedCellColors.background);
 await expect(page.locator('[data-content-type="diagram"]').getByRole('img',{name:'Mermaid 图表'})).toBeVisible();
});

test('advanced data tables keep search sorting sticky columns and card view in Fumadocs',async({page})=>{
 await page.goto('/design-preview/fumadocs-reader');
 const grid=page.locator('[data-fumadocs-advanced-table="email-advanced-grid"]');
 await expect(grid).toBeVisible();
 await expect(grid.locator('.reader-data-table-grid')).toHaveClass(/sticky-header/);
 await expect(grid.locator('.reader-data-table-grid')).toHaveClass(/sticky-first-column/);
 await expect(grid.getByRole('row')).toHaveCount(4);
 await grid.getByRole('searchbox',{name:'查找表格内容'}).fill('关闭');
 await expect(grid.getByRole('status')).toHaveText('显示 1 / 3 行');
 await expect(grid.getByRole('cell',{name:'暂停申请'})).toBeVisible();
 await expect(grid.getByRole('cell',{name:'可以申请'})).toHaveCount(0);
 await grid.getByRole('searchbox',{name:'查找表格内容'}).fill('');
 await grid.getByRole('button',{name:'排序：状态'}).click();
 await expect(grid.getByRole('button',{name:'排序：状态'})).toHaveAttribute('aria-pressed','true');
 const cards=page.locator('[data-fumadocs-advanced-table="email-advanced-cards"]');
 await expect(cards).toBeVisible();
 await expect(cards.locator('.reader-data-table')).toHaveAttribute('data-view','cards');
 await expect(cards.locator('.reader-data-table-cards')).toHaveAttribute('aria-label','表格卡片');
 await expect(cards.locator('.reader-data-table-cards')).toBeVisible();
 await expect(cards.locator('.reader-data-table-cards').getByText('身份证明',{exact:true})).toBeVisible();
 await expect(page.getByText('Unsupported custom block')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('reusable content shows its published children without editor wrapper text',async({page})=>{
 await page.goto('/design-preview/fumadocs-reader');
 const reusable=page.getByText('这是已经审核的共用内容，请按照',{exact:false});
 await expect(reusable).toBeVisible();
 await expect(page.getByRole('link',{name:'账户安全规范'})).toHaveAttribute('href','https://example.com/shared-policy');
 await expect(page.getByText('账户安全共用说明',{exact:true})).toHaveCount(0);
 await expect(page.getByText(/Version 3|第 3 版/)).toHaveCount(0);
 await expect(page.getByText('Unsupported custom block')).toHaveCount(0);
});

test('official page actions preserve protected JUYU operations and reading preferences',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);
 await page.route('**/api/articles/fumadocs-preview/markdown?revision=1',route=>route.fulfill({contentType:'text/markdown; charset=utf-8',body:'# 如何修改账户邮箱'}));
 await page.goto('/design-preview/fumadocs-reader');
 const actions=page.locator('[data-fumadocs-publication-actions]');
 const officialBar=actions.locator('[data-fumadocs-page-actions]');
 await expect(officialBar).toBeVisible();
 await expect(officialBar).toHaveCSS('display','flex');
 await expect(officialBar).toHaveCSS('border-bottom-style','solid');
 await expect(actions.getByRole('button',{name:'复制 Markdown'})).toBeVisible();
 await actions.getByRole('button',{name:'复制 Markdown'}).click();
 await expect.poll(()=>page.evaluate(()=>navigator.clipboard.readText())).toBe('# 如何修改账户邮箱');
 await expect(actions.getByRole('link',{name:'查看 Markdown'})).toHaveAttribute('href','/api/articles/fumadocs-preview/markdown?revision=1');
 await expect(actions.getByRole('link',{name:'PDF 阅读／导出'})).toHaveAttribute('href','/help-centre/pdf?article=fumadocs-preview&revision=1');
 await expect(actions.getByText('阅读外观',{exact:true})).toBeVisible();
 await actions.getByText('阅读外观',{exact:true}).click();
 const paragraph=page.getByText('账户邮箱是登录本站的重要凭证。修改前请先完成身份核对，并确认新邮箱可以正常收信。',{exact:true});
 const before=Number.parseFloat(await paragraph.evaluate(element=>getComputedStyle(element).fontSize));
 await actions.getByRole('button',{name:'大',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-reader-size','large');
 const after=Number.parseFloat(await paragraph.evaluate(element=>getComputedStyle(element).fontSize));
 expect(after).toBeGreaterThan(before);
 await actions.getByRole('button',{name:'宽',exact:true}).click();
 await actions.getByRole('button',{name:'衬线',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-reader-width','wide');
 await expect(page.locator('html')).toHaveAttribute('data-reader-font','serif');
 await page.reload();
 await expect(page.locator('html')).toHaveAttribute('data-reader-size','large');
 await expect(page.locator('html')).toHaveAttribute('data-reader-width','wide');
 await expect(page.locator('html')).toHaveAttribute('data-reader-font','serif');
 await page.locator('[data-fumadocs-publication-actions]').getByText('阅读外观',{exact:true}).click();
 await page.locator('[data-fumadocs-publication-actions]').getByRole('button',{name:'恢复默认'}).click();
 await expect(page.locator('html')).toHaveAttribute('data-reader-size','default');
 await expect(page.locator('html')).toHaveAttribute('data-reader-width','comfortable');
 await expect(page.locator('html')).toHaveAttribute('data-reader-font','sans');
 await expect(page.getByRole('region',{name:'文章反馈'})).toBeVisible();
 await expect(page.getByText('这篇文章有帮助吗？',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'有帮助',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'补充说明（选填）'})).toBeFocused();
 if((page.viewportSize()?.width??1440)<1280)await page.getByRole('button',{name:'开启侧边栏'}).click();
 const language=page.getByRole('button',{name:'选择语言'});
 await expect(language).toBeVisible();
 await language.click();
 await expect(page.getByRole('button',{name:'English',exact:true})).toBeVisible();
 await expect(page.getByText(/Coming soon/i)).toHaveCount(0);
});

test('formal article route keeps the employee gate and Fumadocs search rejects ambiguous input',async({page})=>{
 const response=await page.request.get('/api/fumadocs-search?query=账户&query=邮箱');
 expect(response.status()).toBe(400);
 expect(response.headers()['cache-control']).toBe('private, no-store');
 await page.goto('/help-centre/articles/fumadocs-preview');
 await expect(page).toHaveURL(/\/sign-in(?:\?|$)/);
});
