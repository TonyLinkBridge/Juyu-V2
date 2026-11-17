import {test,expect,type Page} from '@playwright/test';
import {workspaceHTML,workspaceRows} from '../helpers/workspace-browser';
const rows=['article','ops','reference','qa'].map((kind,i)=>({...workspaceRows[0],id:`bulk-${i}`,kind:kind as 'article'|'ops'|'reference'|'qa',status:'in_review' as const,sequence:5,revision:2,title:`批量撤回测试 ${kind}`,submitter:i%2?'测试提交人 B':'测试提交人 A',reviewer:'测试二审人',publishedRevision:1}));
const other={...rows[0],id:'already-published',title:'已发布资料不可选择',status:'published' as const};
const ack={items:rows.map(r=>({documentId:r.id,sequence:6,revision:2,action:'withdraw',status:'draft',previousReviewerId:'reviewer',reviewerId:null,publishedRevision:1}))};
async function mount(page:Page){await page.route(url=>url.pathname==='/admin',async route=>route.fulfill({contentType:'text/html',body:await workspaceHTML(route.request().url(),{rows:[...rows,other]})}));await page.goto('/admin?view=list');}
async function select(page:Page){await page.getByLabel('全选本页等待审核资料',{exact:true}).check();await page.getByRole('button',{name:'批量撤回送审',exact:true}).click();}
test('current-page selection confirms all four kinds once; cancel has no write and success preserves formal content',async({page},info)=>{
 let posts=0;await page.route('**/api/admin/review/bulk-withdraw',async route=>{posts++;expect(route.request().postDataJSON()).toEqual({items:rows.map(r=>({documentId:r.id,expectedSequence:5,revision:2,publishedRevision:1}))});return route.fulfill({json:ack});});
 await page.route('**/api/admin/workspace?*',route=>route.fulfill({status:503,json:{error:'UNAVAILABLE'}}));
 await mount(page);await expect(page.getByRole('button',{name:'批量撤回送审',exact:true})).toBeDisabled();await expect(page.getByRole('checkbox')).toHaveCount(5);await select(page);
 await expect(page.getByRole('dialog')).toContainText('4 份');await expect(page.getByRole('dialog')).toContainText('已有正式版继续保留');await page.getByRole('button',{name:'取消',exact:true}).click();expect(posts).toBe(0);
 await page.getByRole('button',{name:'批量撤回送审',exact:true}).click();await page.getByRole('button',{name:'确认撤回 4 份',exact:true}).click();await expect(page.getByRole('status',{name:'批量操作结果'})).toContainText('已撤回 4 份');expect(posts).toBe(1);
 await expect(page.getByRole('alert')).toContainText('列表');await expect(page.getByRole('button',{name:'批量撤回送审',exact:true})).toBeDisabled();await expect(page.locator('td[data-label="状态"]')).toContainText(['草稿','草稿','草稿','草稿','已经发布']);await expect(page.getByText('旧正式版继续可读')).toHaveCount(4);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`output/verification/bulk-withdraw-${info.project.name}.png`,fullPage:true});
});
test('uncertain result locks the original selection and retries exactly once without changing versions',async({page})=>{
 const writes:unknown[]=[];await page.route('**/api/admin/review/bulk-withdraw',r=>{writes.push(r.request().postDataJSON());return r.fulfill({json:writes.length===1?{items:[]}:ack});});await page.route('**/api/admin/workspace?*',r=>r.fulfill({status:503,json:{error:'UNAVAILABLE'}}));await mount(page);await select(page);await page.getByRole('button',{name:'确认撤回 4 份',exact:true}).click();await expect(page.getByRole('alert')).toContainText('尚未确认');await expect(page.getByRole('button',{name:'取消',exact:true})).toBeDisabled();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'重试原批次',exact:true}).click();await expect(page.getByRole('status',{name:'批量操作结果'})).toContainText('已撤回 4 份');expect(writes).toHaveLength(2);expect(writes[0]).toEqual(writes[1]);
});
test('stale selection is not automatically re-submitted after a conflict',async({page})=>{
 let writes=0;await page.route('**/api/admin/review/bulk-withdraw',r=>{writes++;return r.fulfill({status:409,json:{error:'CONFLICT'}});});await mount(page);await select(page);await page.getByRole('button',{name:'确认撤回 4 份',exact:true}).click();await expect(page.getByRole('alert')).toContainText('整批');await expect(page.getByRole('button',{name:'确认撤回 4 份',exact:true})).toBeDisabled();expect(writes).toBe(1);
});

test('successful refresh updates the real counts',async({page})=>{
 await page.route('**/api/admin/review/bulk-withdraw',r=>r.fulfill({json:ack}));
 await page.route('**/api/admin/workspace?*',r=>r.fulfill({json:{query:{q:'',scope:'all',kind:'all',status:'all',view:'list',page:1},items:[...rows.map(row=>({...row,status:'draft',sequence:6,submitter:null,reviewer:null})),other],counts:{draft:4,in_review:0,changes_requested:0,approved:0,queued:0,published:1},total:5,pages:1,page:1}}));
 await mount(page);await page.getByLabel(`选择资料：${rows[0].title}`,{exact:true}).check();await expect(page.getByText('已选 1 份 · 仅当前页，最多 30 份',{exact:true})).toBeVisible();await page.getByLabel('全选本页等待审核资料',{exact:true}).check();await page.getByRole('button',{name:'批量撤回送审',exact:true}).click();await page.getByRole('button',{name:'确认撤回 4 份',exact:true}).click();await expect(page.getByRole('link',{name:'草稿 4',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'等待审核 0',exact:true})).toBeVisible();await expect(page.getByRole('alert')).toHaveCount(0);
});
test('a rejected retry can reread history without a false success or automatically withdrawing new submissions',async({page})=>{
 let posts=0;await page.route('**/api/admin/review/bulk-withdraw',r=>{posts++;return r.fulfill(posts===1?{json:{items:[]}}:{status:409,json:{error:'CONFLICT'}});});
 await page.route('**/api/admin/workspace?*',r=>r.fulfill({json:{query:{q:'',scope:'all',kind:'all',status:'all',view:'list',page:1},items:[...rows.map(row=>({...row,sequence:7})),other],counts:{draft:0,in_review:4,changes_requested:0,approved:0,queued:0,published:1},total:5,pages:1,page:1}}));
 await mount(page);await select(page);await page.getByRole('button',{name:'确认撤回 4 份',exact:true}).click();await page.getByRole('button',{name:'重试原批次',exact:true}).click();await expect(page.getByRole('alert')).toContainText('原批次结果仍需核对');await expect(page.getByRole('status',{name:'批量操作结果'})).toHaveCount(0);await page.getByRole('button',{name:'重新读取列表',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.getByRole('button',{name:'批量撤回送审',exact:true})).toBeDisabled();expect(posts).toBe(2);
});
test('selection is current-page only and leaving asks before discarding it',async({page})=>{
 const pages=Array.from({length:31},(_,i)=>({...rows[0],id:`page-${i}`,title:`跨页选择测试 ${i}`}));await page.route(url=>url.pathname==='/admin',async route=>route.fulfill({contentType:'text/html',body:await workspaceHTML(route.request().url(),{rows:pages})}));await page.goto('/admin?view=list');await page.getByLabel('全选本页等待审核资料',{exact:true}).check();await expect(page.getByText('已选 30 份 · 仅当前页，最多 30 份',{exact:true})).toBeVisible();await page.getByRole('link',{name:'下一页',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('尚未提交');await page.getByRole('button',{name:'确认继续',exact:true}).click();await expect(page).toHaveURL(/page=2/);await expect(page.getByText('已选 0 份 · 仅当前页，最多 30 份',{exact:true})).toBeVisible();await expect(page.getByRole('checkbox')).toHaveCount(2);
});
test('real batch endpoint rejects forged administrator headers and has no readable GET mutation',async({request})=>{
 const response=await request.post('/api/admin/review/bulk-withdraw',{headers:{origin:'http://127.0.0.1:3210','x-role':'super_admin','x-user-id':'forged'},data:{items:rows.map(row=>({documentId:row.id,expectedSequence:5,revision:2,publishedRevision:1}))}});expect([403,503]).toContain(response.status());expect(response.headers()['cache-control']).toBe('private, no-store');expect(await response.text()).not.toContain('sequence');expect((await request.get('/api/admin/review/bulk-withdraw')).status()).toBe(405);
});

test('a rejected batch plus failed refresh never claims a successful withdrawal',async({page})=>{
 await page.route('**/api/admin/review/bulk-withdraw',r=>r.fulfill({status:409,json:{error:'CONFLICT'}}));await page.route('**/api/admin/workspace?*',r=>r.fulfill({status:503,json:{error:'UNAVAILABLE'}}));await mount(page);await select(page);await page.getByRole('button',{name:'确认撤回 4 份',exact:true}).click();await page.getByRole('button',{name:'重新读取列表',exact:true}).click();await expect(page.getByRole('dialog').getByRole('alert')).toContainText('列表读取失败');await page.getByRole('button',{name:'取消',exact:true}).click();await expect(page.getByRole('alert')).not.toContainText('已确认的撤回');await expect(page.getByRole('status',{name:'批量操作结果'})).toHaveCount(0);
});

test('closing a conflict cannot reopen and resubmit the same stale selection without rereading',async({page})=>{
 let writes=0;await page.route('**/api/admin/review/bulk-withdraw',r=>{writes++;return r.fulfill({status:409,json:{error:'CONFLICT'}});});await mount(page);await select(page);await page.getByRole('button',{name:'确认撤回 4 份',exact:true}).click();await page.getByRole('button',{name:'取消',exact:true}).click();await expect(page.getByRole('button',{name:'批量撤回送审',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'重新读取列表',exact:true})).toBeVisible();expect(writes).toBe(1);
});
