import {test,expect} from '@playwright/test';
import {workspaceHTML} from '../helpers/workspace-browser';
async function fixture(page:import('@playwright/test').Page,options:{empty?:boolean;failed?:boolean}={}){
 await page.route(url=>url.pathname==='/admin',async route=>route.fulfill({contentType:'text/html',body:await workspaceHTML(route.request().url(),options)}));
 await page.goto('/admin');
}
test('workspace renders real-count contract and responsive list with safe titles',async({page},info)=>{
 await fixture(page);await expect(page.getByRole('heading',{name:'内容管理',exact:true})).toBeVisible();
 await expect(page.locator('.tasks-results [role=status]')).toContainText('共 36 篇');
 await expect(page.getByRole('navigation',{name:'按状态查看'}).getByRole('link')).toHaveCount(6);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const visible=info.project.name==='mobile'?page.locator('.tasks-mobile-list'):page.locator('.tasks-desktop-board');
 await expect(visible.getByRole('link',{name:'中文标题 <script> 不执行',exact:true})).toBeVisible();
 await expect(visible.getByText(info.project.name==='mobile'?'旧正式版继续可读':'旧正式版 仍可阅读').first()).toBeVisible();
 if(info.project.name==='mobile')await expect(page.getByText('手机列表',{exact:true})).toBeVisible();
 else{await page.getByRole('link',{name:'列表',exact:true}).click();await expect(page.locator('.tasks-all-list')).toBeVisible();}
 await expect(page.getByRole('button',{name:'放弃本次修订'})).toHaveCount(1);
 await expect(page.getByRole('button',{name:'删除草稿'})).toHaveCount(4);
 if(info.project.name!=='mobile'){await page.reload();await expect(page.locator('.tasks-all-list')).toBeVisible();await page.getByRole('link',{name:'看板',exact:true}).click();}
 await page.screenshot({path:`output/verification/workspace-${info.project.name}.png`,fullPage:false});
 await page.evaluate(()=>document.documentElement.classList.add('dark'));await page.screenshot({path:`output/verification/workspace-dark-${info.project.name}.png`,fullPage:false});
 if(info.project.name==='mobile'){await page.locator('.tasks-mobile-list').scrollIntoViewIfNeeded();await page.screenshot({path:'output/verification/workspace-mobile-content.png',fullPage:false});}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const contrasts=await page.locator('.task-status-filters strong').evaluateAll(nodes=>nodes.map(node=>{
  const luminance=(rgb:string)=>{const values=rgb.match(/[\d.]+/g)!.slice(0,3).map(Number).map(x=>{x/=255;return x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4;});return values[0]*0.2126+values[1]*0.7152+values[2]*0.0722;};
  const foreground=luminance(getComputedStyle(node).color),background=luminance(getComputedStyle(node.parentElement!).backgroundColor);
  return (Math.max(foreground,background)+0.05)/(Math.min(foreground,background)+0.05);
 }));expect(Math.min(...contrasts)).toBeGreaterThanOrEqual(4.5);
});
test('workspace filters by personal scope, kind and status and resets page via keyboard',async({page})=>{
 await fixture(page);await page.getByRole('link',{name:'下一页',exact:true}).click();await expect(page.locator('.tasks-results [role=status]')).toContainText('第 2 / 2 页');
 await page.getByRole('link',{name:'退回给我的',exact:true}).focus();await page.keyboard.press('Enter');
 await expect(page.locator('.tasks-results [role=status]')).toContainText('共 6 篇 · 第 1 / 1 页');await expect(page.getByRole('link',{name:'退回给我的',exact:true})).toHaveAttribute('aria-current','page');
 await page.reload();await expect(page.getByRole('link',{name:'退回给我的',exact:true})).toHaveAttribute('aria-current','page');
 await page.getByRole('link',{name:'待我审核',exact:true}).click();await expect(page.getByRole('heading',{name:'没有符合条件的内容'})).toBeVisible();
 await page.getByRole('button',{name:'清除全部',exact:true}).click();await page.getByLabel('资料类型').selectOption('ops');await page.getByRole('button',{name:'应用筛选'}).click();await expect(page.locator('.tasks-results [role=status]')).toContainText('共 12 篇');
 await page.getByRole('navigation',{name:'按状态查看'}).getByRole('link',{name:/^草稿\s*6$/}).click();await expect(page.locator('.tasks-results [role=status]')).toContainText('共 6 篇');
 await page.getByLabel('搜索标题').fill('no-match');await page.getByRole('button',{name:'应用筛选'}).click();await expect(page.getByRole('heading',{name:'没有符合条件的内容'})).toBeVisible();
});
test('workspace primary filter action keeps readable text contrast',async({page})=>{
 await fixture(page);
 const colors=await page.getByRole('button',{name:'应用筛选'}).evaluate(button=>{
  const style=getComputedStyle(button);
  return {color:style.color,background:style.backgroundColor};
 });
 expect(colors.color).toBe('rgb(255, 255, 255)');
 expect(colors.background).not.toBe('rgba(0, 0, 0, 0)');
});
test('workspace service failure is distinct from empty and retry recovers',async({page})=>{
 await fixture(page,{failed:true});await expect(page.getByRole('heading',{name:'内容暂时无法读取'})).toBeVisible();await expect(page.getByText(/共 0 篇/)).toHaveCount(0);
 await page.unrouteAll();await page.route(url=>url.pathname==='/admin',async route=>route.fulfill({contentType:'text/html',body:await workspaceHTML(route.request().url(),{empty:true})}));
 await page.getByRole('link',{name:'重新读取内容'}).click();await expect(page.getByRole('heading',{name:'没有符合条件的内容'})).toBeVisible();await expect(page.locator('.tasks-results [role=status]')).toContainText('共 0 篇');
});
test('real workspace endpoint and admin page reject missing or forged identities',async({request,page})=>{
 const r=await request.get('/api/admin/workspace?scope=review&role=admin&actorId=a',{headers:{'x-role':'admin','x-user-id':'a'}});expect(r.status()).toBe(503);expect(r.headers()['cache-control']).toBe('private, no-store');expect(await r.text()).not.toContain('items');
 const post=await request.post('/api/admin/workspace',{data:{status:'published'}});expect(post.status()).toBe(405);
 await page.goto('/admin?scope=review');await expect(page.getByRole('heading',{name:'内容管理',exact:true})).toHaveCount(0);
});

test('R08 Reference workspace exposes the matching title and editor type',async({page})=>{
 await fixture(page);await page.goto('/admin?kind=reference&view=list');await expect(page.getByRole('heading',{name:'Reference 管理',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'＋ 新建速查资料',exact:true})).toHaveAttribute('href','/admin/editor?kind=reference');
});

test('content toolbar applies real status and removes only that condition',async({page})=>{
 await fixture(page);await page.goto('/admin?q=资料&kind=article&scope=submitted&view=list&page=2');
 await page.getByRole('button',{name:'添加筛选',exact:true}).click();await page.getByRole('menuitem',{name:/^内容状态/}).click();await page.getByRole('menuitemradio',{name:'已经发布',exact:true}).click();
 await expect(page).toHaveURL(/status=published/);const params=new URL(page.url()).searchParams;
 expect(Object.fromEntries(params)).toMatchObject({q:'资料',kind:'article',scope:'submitted',view:'list',status:'published',page:'1'});
 await expect(page.locator('.tasks-results [role=status]')).toContainText('共 6 篇');
 await page.getByRole('button',{name:'移除 内容状态: 已经发布',exact:true}).click();
 await expect(page).toHaveURL(/status=all/);expect(new URL(page.url()).searchParams.get('scope')).toBe('submitted');
 await expect(page.getByLabel('搜索标题')).toHaveValue('资料');
});


test('approved and queued rows offer immediate publication and keep status text on one line',async({page},info)=>{
 const {workspaceRows}=await import('../helpers/workspace-browser');
 const rows=['article','ops','reference','qa'].flatMap((kind,i)=>['approved','queued'].map((status,j)=>({...workspaceRows[0],id:`release-${i}-${j}`,kind:kind as 'article'|'ops'|'reference'|'qa',status:status as 'approved'|'queued',title:'首次操作预定时，如果预定错误了怎么办？需要完整说明的测试标题',submitter:'tracy.long.test.account@example.test',reviewer:'haley.long.test.account@example.test',publishedRevision:null})));
 if(info.project.name==='desktop')await page.setViewportSize({width:1000,height:900});
 await page.route(url=>url.pathname==='/admin',async route=>route.fulfill({contentType:'text/html',body:await workspaceHTML(route.request().url(),{rows})}));
 await page.goto('/admin?view=list');
 const table=page.locator('.tasks-all-list');
 const lines=await table.locator('td[data-label="状态"] .task-state').evaluateAll(elements=>elements.map(element=>{const range=document.createRange();range.selectNodeContents(element);return new Set(Array.from(range.getClientRects()).filter(rect=>rect.width>0).map(rect=>Math.round(rect.y))).size;}));
 expect(lines).toEqual(Array(8).fill(1));
 if(info.project.name==='desktop')expect(await table.locator('tbody td:first-child').first().evaluate(element=>element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(220);
 await expect(table.getByRole('link',{name:'立即发布',exact:true})).toHaveCount(8);
 await expect(table.getByRole('link',{name:'立即发布',exact:true}).first()).toHaveAttribute('href','/admin/review/publish?article=release-0-0&intent=publish_now');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`output/verification/immediate-workspace-${info.project.name}.png`,fullPage:true});
 if(info.project.name==='desktop'){await page.getByRole('link',{name:'看板',exact:true}).click();await expect(page.locator('.tasks-desktop-board').getByRole('link',{name:'立即发布',exact:true})).toHaveCount(8);}

});
