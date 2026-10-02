import {test,expect,type Page} from '@playwright/test';
import {navigationBrowserBundle} from '../helpers/navigation-browser';
import {workspaceQuery,statuses,type WorkspaceItem,type WorkspaceData} from '../../src/workspace/model';
let bundle:Awaited<ReturnType<typeof navigationBrowserBundle>>;
test.beforeAll(async()=>{bundle=await navigationBrowserBundle();});
const row=(id:string,kind:WorkspaceItem['kind'],paths:string[]):WorkspaceItem=>({id,title:`分类核对 ${kind}`,kind,status:'draft',sequence:2,revision:2,publishedRevision:id==='article'?1:null,updatedAt:'2026-10-02T09:00:00Z',author:'管理员',editor:'管理员',submitter:null,reviewer:null,categoryPaths:paths,publishedCategoryPaths:['正式目录 / 账户安全'],...(kind==='qa'?{qaCategory:'信用额度',qaPosition:3}:{})});
const items=[row('article','article',['草稿目录 / MFA']),row('ops','ops',['运营 / 第一项','运营 / 第二项','运营 / 第三项']),row('reference','reference',[]),row('qa','qa',[])];
async function mount(page:Page,view:'list'|'board'){
 const data:WorkspaceData={query:workspaceQuery({view}),items,counts:Object.fromEntries(statuses.map(s=>[s.id,s.id==='draft'?4:0])) as WorkspaceData['counts'],total:4,page:1,pages:1};
 await page.route('**/__workspace-categories',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.css}</style></head><body><div id="presentation"></div><script id="data" type="application/json">${JSON.stringify({pendingWorkspace:{data}})}</script><script>${bundle.script.replaceAll('</script','<\\/script')}</script></body></html>`}));await page.goto('/__workspace-categories');
}
for(const view of ['list','board'] as const)test(`workspace ${view} shows categories for every kind and all extra paths remain accessible`,async({page},info)=>{
 await mount(page,view);const visible=page.locator(view==='list'?'.tasks-all-list':info.project.name==='mobile'?'.tasks-mobile-list':'.tasks-desktop-board');
 await expect(visible.getByText('分类：草稿目录 / MFA',{exact:true})).toBeVisible();
 await expect(visible.getByText('分类：未分类',{exact:true})).toBeVisible();
 await expect(visible.getByText('分类：信用额度 · 排序：3（数字越小越靠前）',{exact:true})).toBeVisible();
 const more=visible.locator('.task-category-details');await expect(more).toContainText('另 1 项');
 await expect(more.getByText('运营 / 第三项',{exact:true})).not.toBeVisible();await more.locator('summary').focus();await page.keyboard.press('Enter');await expect(more.getByText('运营 / 第三项',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`output/verification/workspace-categories-${view}-${info.project.name}.png`,fullPage:false});
 await page.evaluate(()=>document.documentElement.classList.add('dark'));expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('discarding a revision immediately replaces draft category text with formal category text',async({page})=>{
 await page.route('**/api/admin/drafts/article/discard',r=>r.fulfill({json:{documentId:'article',sequence:3,revision:1,publishedRevision:1,status:'published'}}));
 await mount(page,'list');const article=page.locator('tr').filter({has:page.getByRole('link',{name:'分类核对 article',exact:true})});
 await article.getByRole('button',{name:'放弃本次修订',exact:true}).click();await page.getByRole('button',{name:'确认放弃修订',exact:true}).click();
 await expect(article.getByText('分类：正式目录 / 账户安全',{exact:true})).toBeVisible();await expect(article.getByText('分类：草稿目录 / MFA',{exact:true})).toHaveCount(0);
});
