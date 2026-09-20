import {queueConfirmation,settleConfirmation} from '../helpers/site-confirmation';
import {test,expect,type Page} from '@playwright/test';
import {categoriesBrowserBundle} from '../helpers/categories-browser';
import type {CategoryDefinition} from '../../src/categories/model';
let bundle:Awaited<ReturnType<typeof categoriesBrowserBundle>>;
test.beforeAll(async()=>{bundle=await categoriesBrowserBundle();});
const parent:CategoryDefinition={id:'00000000-0000-4000-8000-000000000049',version:1,name:'运营流程',parentId:null,position:0,audience:'ops',enabled:true};
const child:CategoryDefinition={...parent,id:'00000000-0000-4000-8000-000000000050',name:'员工操作',parentId:parent.id,audience:'staff'};
const sibling:CategoryDefinition={...parent,id:'00000000-0000-4000-8000-000000000051',name:'通用说明',position:10,audience:'staff'};
async function mount(page:Page,props:unknown={initial:[parent,child,sibling]}){
 await page.route('**/__categories_fixture',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.css}</style></head><body><header>分类设置 · 本地测试样例（非真实公司设置）</header><main><div id="categories"></div></main><script id="data" type="application/json">${JSON.stringify(props).replace(/</g,'\\u003c')}</script><script>${bundle.script.replace(/<\/script/gi,'<\\/script')}</script></body></html>`}));
 await page.goto('/__categories_fixture');
}
function acknowledged(url:string,write:Record<string,unknown>){const {expectedVersion,...config}=write;return {...config,id:new URL(url).pathname.split('/').pop(),version:Number(expectedVersion??0)+1};}

test('creates subcategory, edits order, inherits scope and renders both themes without overflow',async({page},info)=>{
 const writes:Record<string,unknown>[]=[];
 await page.route('**/api/admin/categories/*',r=>{const x=r.request().postDataJSON();writes.push(x);return r.fulfill({json:acknowledged(r.request().url(),x)});});
 await mount(page);
 await page.getByRole('button',{name:/员工操作/}).click();await settleConfirmation(page);
 await expect(page.locator('.category-settings-policy')).toContainText('运营和管理员');
 await page.getByRole('button',{name:'新建分类',exact:true}).click();await settleConfirmation(page);
 await page.getByLabel('分类名称',{exact:true}).fill('新增子分类 <script>');
 await page.getByLabel('父分类',{exact:true}).selectOption(parent.id);
 await page.getByLabel('排序',{exact:true}).fill('7');
 await page.getByRole('button',{name:'保存分类',exact:true}).click();await settleConfirmation(page);
 await expect(page.getByRole('status')).toContainText('已保存');
 expect(writes[0]).toMatchObject({expectedVersion:null,parentId:parent.id,position:7,audience:'staff'});
 await page.getByLabel('排序',{exact:true}).fill('2');
 await page.getByRole('button',{name:'保存分类',exact:true}).click();await settleConfirmation(page);
 await expect(page.getByRole('status')).toContainText('已保存');
 expect(writes[1]).toMatchObject({expectedVersion:1,position:2});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(page.locator('main script')).toHaveCount(0);
 await page.screenshot({path:`output/verification/categories-${info.project.name}.png`,fullPage:true,animations:'disabled'});
 await page.evaluate(()=>document.documentElement.dataset.theme='dark');
 await expect.poll(()=>page.locator('html').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(25, 25, 31)');
 await page.screenshot({path:`output/verification/categories-dark-${info.project.name}.png`,fullPage:true,animations:'disabled'});
});
test('selected category icon is included in the saved settings',async({page})=>{
 const writes:Record<string,unknown>[]=[];
 await page.route('**/api/admin/categories/*',r=>{const input=r.request().postDataJSON();writes.push(input);return r.fulfill({json:acknowledged(r.request().url(),input)});});
 await mount(page);
 await page.getByRole('button',{name:/员工操作/}).click();
 await page.getByRole('combobox',{name:'目录图标'}).selectOption('shield');
 await page.getByRole('button',{name:'保存分类',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('已保存');
 expect(writes[0].iconKey).toBe('shield');
 await expect(page.getByRole('combobox',{name:'目录图标'})).toHaveValue('shield');
});

test('parent picker excludes self and descendants; existing policy edits require immediate-access confirmation',async({page})=>{
 const writes:Record<string,unknown>[]=[];
 await page.route('**/api/admin/categories/*',r=>{const x=r.request().postDataJSON();writes.push(x);return r.fulfill({json:acknowledged(r.request().url(),x)});});
 await mount(page);
 await page.getByRole('button',{name:/运营流程/}).click();await settleConfirmation(page);
 await expect(page.locator(`#category-parent option[value="${parent.id}"]`)).toHaveCount(0);
 await expect(page.locator(`#category-parent option[value="${child.id}"]`)).toHaveCount(0);
 await page.getByLabel('启用分类').uncheck();
 await expect(page.getByText('此修改会立即影响已有正式内容及子分类的访问。保存前需要再次确认。')).toBeVisible();
 queueConfirmation(page,async d=>{expect(d.message()).toContain('立即更新');await d.dismiss();});
 await page.getByRole('button',{name:'保存分类',exact:true}).click();await settleConfirmation(page);
 expect(writes).toHaveLength(0);
 queueConfirmation(page,d=>d.accept());
 await page.getByRole('button',{name:'保存分类',exact:true}).click();await settleConfirmation(page);
 await expect(page.getByRole('status')).toContainText('分类已停用');
 expect(writes[0]).toMatchObject({expectedVersion:1,enabled:false});
 await expect(page.getByRole('button',{name:/员工操作/})).toContainText('已停用：关联内容不向员工开放');
});

test('uncertain result freezes original UUID and payload; retry confirms exact version',async({page})=>{
 const writes:{url:string;body:unknown}[]=[];
 await page.route('**/api/admin/categories/*',r=>{const x=r.request().postDataJSON();writes.push({url:r.request().url(),body:x});return r.fulfill({json:{...acknowledged(r.request().url(),x),version:writes.length===1?99:1}});});
 await mount(page);
 await page.getByRole('button',{name:'新建分类',exact:true}).click();await settleConfirmation(page);
 await page.getByLabel('分类名称',{exact:true}).fill('稳定编号');
 await page.getByRole('button',{name:'保存分类',exact:true}).click();await settleConfirmation(page);
 await expect(page.getByRole('alert')).toContainText('无法确认');
 await expect(page.getByLabel('分类名称',{exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'新建分类',exact:true})).toBeDisabled();
 await expect(page.getByRole('link',{name:'设置变更记录'})).not.toHaveAttribute('href');
 await page.getByRole('button',{name:'重试原提交'}).click();await settleConfirmation(page);
 await expect(page.getByRole('status')).toContainText('已保存');
 expect(writes).toHaveLength(2);expect(writes[0]).toEqual(writes[1]);
});

test('unknown then conflict remains uncertain and can recover through explicit latest reload',async({page})=>{
 let attempts=0;
 await page.route('**/api/admin/categories/*',r=>++attempts===1?r.fulfill({status:503}):r.fulfill({status:409,json:{error:'CATEGORY_CONFLICT'}}));
 await page.route('**/api/admin/categories',r=>r.fulfill({json:[{...parent,name:'服务器当前分类',version:3},child,sibling]}));
 await mount(page);
 await page.getByRole('button',{name:/运营流程/}).click();await settleConfirmation(page);
 await page.getByLabel('分类名称',{exact:true}).fill('本地改名');
 await page.getByRole('button',{name:'保存分类',exact:true}).click();await settleConfirmation(page);
 await page.getByRole('button',{name:'重试原提交'}).click();await settleConfirmation(page);
 await expect(page.getByRole('alert')).toContainText('仍无法确认此前是否保存成功');
 await expect(page.getByLabel('分类名称',{exact:true})).toHaveValue('本地改名');
 queueConfirmation(page,async d=>{expect(d.message()).toContain('不会撤销');await d.accept();});
 await page.getByRole('button',{name:'载入最新设置（替换当前输入）'}).click();await settleConfirmation(page);
 await expect(page.getByLabel('分类名称',{exact:true})).toHaveValue('服务器当前分类');
 await expect(page.getByLabel('分类名称',{exact:true})).toBeEnabled();
 await expect(page.getByRole('status')).toContainText('此前提交是否曾保存仍无法确认');
});

test('definite conflict preserves edits, reload failure preserves recovery, and reload adopts latest version',async({page})=>{
 let reads=0;
 await page.route('**/api/admin/categories/*',r=>r.fulfill({status:409,json:{error:'CATEGORY_CONFLICT'}}));
 await page.route('**/api/admin/categories',r=>++reads===1?r.fulfill({status:503}):r.fulfill({json:[{...parent,name:'最新分类',version:3},child,sibling]}));
 await mount(page);await page.getByRole('button',{name:/运营流程/}).click();await settleConfirmation(page);
 await page.getByLabel('分类名称',{exact:true}).fill('未保存输入');
 await page.getByRole('button',{name:'保存分类',exact:true}).click();await settleConfirmation(page);
 await expect(page.getByRole('alert')).toContainText('已有新版本');
 await expect(page.getByRole('button',{name:'保存分类',exact:true})).toBeDisabled();
 queueConfirmation(page,d=>d.accept());
 await page.getByRole('button',{name:'载入最新设置（替换当前输入）'}).click();await settleConfirmation(page);
 await expect(page.getByRole('alert')).toContainText('暂时无法载入');
 await expect(page.getByLabel('分类名称',{exact:true})).toHaveValue('未保存输入');
 await page.getByRole('button',{name:'载入最新设置（替换当前输入）'}).click();await settleConfirmation(page);
 await expect(page.getByLabel('分类名称',{exact:true})).toHaveValue('最新分类');
});

test('unsaved changes guard close, new, selection, navigation and page unload',async({page})=>{
 await mount(page);await page.getByRole('button',{name:/运营流程/}).click();await settleConfirmation(page);
 await page.getByLabel('分类名称',{exact:true}).fill('尚未保存');
 for(const button of [page.getByRole('button',{name:'关闭编辑'}),page.getByRole('button',{name:'新建分类',exact:true}),page.getByRole('button',{name:/通用说明/}),page.getByRole('link',{name:'设置变更记录'})]){
  queueConfirmation(page,d=>d.dismiss());await button.click();await settleConfirmation(page);await expect(page.getByLabel('分类名称',{exact:true})).toHaveValue('尚未保存');
 }
 expect(await page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;})).toBe(true);
});

test('empty, unavailable and denied are distinct and failed reads never expose a fake empty list',async({page})=>{
 await mount(page,{initial:[],state:'ready'});
 await expect(page.getByText('还没有分类。点击“新建分类”添加第一项。')).toBeVisible();
 await page.unrouteAll();await mount(page,{initial:[parent],state:'unavailable'});
 await expect(page.getByText('分类设置暂时不可用')).toBeVisible();
 await expect(page.getByRole('button',{name:/运营流程/})).toHaveCount(0);
 await expect(page.getByText('还没有分类。点击“新建分类”添加第一项。')).toHaveCount(0);
 await page.route('**/api/admin/categories',r=>r.fulfill({status:503}));
 await page.getByRole('button',{name:'重新载入',exact:true}).click();await settleConfirmation(page);
 await expect(page.getByRole('alert')).toContainText('暂时无法载入');
 await page.unrouteAll();await mount(page,{initial:[parent],state:'denied'});
 await expect(page.getByText('没有管理权限')).toBeVisible();
 await expect(page.getByRole('button',{name:'新建分类',exact:true})).toHaveCount(0);
});

test('R09 categories show parent child nesting and retain selection at ten levels',async({page},info)=>{
 const chain=Array.from({length:10},(_,i)=>({...parent,id:`00000000-0000-4000-8000-${String(100+i).padStart(12,'0')}`,name:`第${i+1}级分类`,parentId:i?`00000000-0000-4000-8000-${String(99+i).padStart(12,'0')}`:null}));
 await mount(page,{initial:chain});const root=page.getByRole('list',{name:'分类层级',exact:true});await expect(root.locator(':scope>li')).toHaveCount(1);await expect(root.getByRole('button',{name:/第1级分类/})).toContainText('主分类');await expect(page.getByRole('list',{name:'第1级分类的子分类',exact:true}).getByRole('button',{name:/第2级分类/})).toContainText('子分类');await root.getByRole('button',{name:/第10级分类/}).click();await settleConfirmation(page);await expect(page.getByLabel('分类名称',{exact:true})).toHaveValue('第10级分类');await expect(root.locator('[aria-pressed=true]')).toHaveCount(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`output/verification/R09-categories-${info.project.name}.png`,fullPage:true});
});

test('R10 site confirmation traps focus, cancels safely and preserves native unload protection',async({page},info)=>{
 let writes=0;await page.route('**/api/admin/categories/*',r=>{writes++;return r.fulfill({status:500});});
 await mount(page);await page.getByRole('button',{name:/运营流程.*主分类/}).click();
 await page.getByLabel('分类名称',{exact:true}).fill('未保存的分类');
 const trigger=page.getByRole('button',{name:'关闭编辑',exact:true});await trigger.click();
 const dialog=page.getByRole('dialog',{name:'确认此操作',exact:true});
 await expect(dialog).toBeVisible();await expect(dialog).toContainText('尚未保存');
 await expect(dialog.getByRole('button',{name:'取消',exact:true})).toBeFocused();
 await page.keyboard.press('Shift+Tab');await expect(dialog.getByRole('button',{name:'确认继续',exact:true})).toBeFocused();
 await page.screenshot({path:`output/verification/R10-confirm-${info.project.name}.png`,fullPage:true});
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
 await expect(page.getByLabel('分类名称',{exact:true})).toHaveValue('未保存的分类');expect(writes).toBe(0);
 expect(await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;})).toBe(true);
 await page.evaluate(()=>document.documentElement.dataset.theme='dark');await trigger.click();await expect(dialog).toBeVisible();
 expect(await dialog.evaluate(e=>e.getBoundingClientRect().right<=innerWidth&&e.getBoundingClientRect().left>=0)).toBe(true);
 await page.screenshot({path:`output/verification/R10-confirm-dark-${info.project.name}.png`,fullPage:true});
 await dialog.getByRole('button',{name:'确认继续',exact:true}).click();await expect(page.getByLabel('分类名称',{exact:true})).toHaveCount(0);expect(writes).toBe(0);
});
