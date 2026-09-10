import {test,expect,type Page} from '@playwright/test';
import {navigationSettingsBrowserBundle} from '../helpers/navigation-settings-browser';
import {defaultNavigationEntries,type NavigationEntry,type NavigationWrite} from '../../src/navigation-settings/model';
import type {CategoryDefinition} from '../../src/categories/model';
let bundle:Awaited<ReturnType<typeof navigationSettingsBrowserBundle>>;
test.beforeAll(async()=>{bundle=await navigationSettingsBrowserBundle();});
const home:NavigationEntry={id:'00000000-0000-4000-8000-000000000071',label:'帮助中心',enabled:true,roles:['support','ops','admin'],target:{type:'page',page:'home'}};
const ops:NavigationEntry={...home,id:'00000000-0000-4000-8000-000000000072',label:'运营知识',roles:['ops','admin'],target:{type:'page',page:'ops'}};
const category:CategoryDefinition={id:'00000000-0000-4000-8000-000000000073',version:1,name:'运营流程',parentId:null,position:0,audience:'ops',enabled:true};
const child:CategoryDefinition={...category,id:'00000000-0000-4000-8000-000000000074',name:'值班手册',parentId:category.id,audience:'staff'};
const disabled:CategoryDefinition={...category,id:'00000000-0000-4000-8000-000000000075',name:'暂停的分类',enabled:false};
const initial={version:1,entries:[home,ops]};const categories=[category,child,disabled];
async function mount(page:Page,props:unknown={initial,categories}){
 await page.route('**/__navigation_settings_fixture',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.css}</style></head><body><header>导航设置 · 本地测试样例（非真实公司配置）</header><main><div id="navigation-settings"></div></main><script id="data" type="application/json">${JSON.stringify(props).replace(/</g,'\\u003c')}</script><script>${bundle.script.replace(/<\/script/gi,'<\\/script')}</script></body></html>`}));await page.goto('/__navigation_settings_fixture');
}
function ack(write:NavigationWrite){return {config:{version:write.expectedVersion+1,entries:write.entries}};}
function entryButton(page:Page,label:string){return page.locator('.navigation-settings-item').filter({has:page.locator('strong',{hasText:label})});}

test('adds category shortcut, changes roles, reorders and renders desktop/mobile light and dark',async({page},info)=>{
 const writes:NavigationWrite[]=[];await page.route('**/api/admin/navigation',r=>{const write=r.request().postDataJSON();writes.push(write);return r.fulfill({json:ack(write)});});
 await mount(page);await expect(page.getByText(/隐藏菜单不会收回内容访问权限/)).toBeVisible();
 await page.getByRole('button',{name:'添加入口',exact:true}).click();
 await page.getByLabel('入口名称',{exact:true}).fill('值班指引 <script>');
 await page.getByLabel('目标类型',{exact:true}).selectOption('category');
 await page.getByLabel('目标分类',{exact:true}).selectOption(child.id);
 await page.getByLabel('客服（Support）',{exact:true}).uncheck();
 await page.getByLabel('启用入口',{exact:true}).check();
 await page.getByRole('button',{name:'上移',exact:true}).click();await page.getByRole('button',{name:'上移',exact:true}).click();
 await page.getByRole('button',{name:'保存导航',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('已保存');
 expect(writes[0]).toMatchObject({expectedVersion:1,entries:[{label:'值班指引 <script>',enabled:true,roles:['ops','admin'],target:{type:'category',categoryId:child.id}},home,ops]});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('main script')).toHaveCount(0);
 await page.screenshot({path:`output/verification/navigation-settings-${info.project.name}.png`,fullPage:true,animations:'disabled'});
 await page.evaluate(()=>document.documentElement.dataset.theme='dark');await expect.poll(()=>page.locator('html').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(25, 25, 31)');
 await page.screenshot({path:`output/verification/navigation-settings-dark-${info.project.name}.png`,fullPage:true,animations:'disabled'});
});

test('OPS choice grants no access, one role must remain and disabled categories stay explicit',async({page})=>{
 await mount(page);await entryButton(page,'运营知识').click();
 await expect(page.getByLabel('客服（Support）',{exact:true})).not.toBeChecked();
 await page.getByLabel('客服（Support）',{exact:true}).check();
 await expect(page.getByText('OPS 仅对运营和管理员开放。勾选客服角色不会授予 OPS 访问权限。')).toBeVisible();
 await page.getByLabel('客服（Support）',{exact:true}).uncheck();await page.getByLabel('运营（Ops）',{exact:true}).uncheck();
 await expect(page.getByLabel('管理员（Admin）',{exact:true})).toBeChecked();await expect(page.getByLabel('管理员（Admin）',{exact:true})).toBeDisabled();
 await page.getByLabel('目标类型',{exact:true}).selectOption('category');await page.getByLabel('目标分类',{exact:true}).selectOption(disabled.id);
 await expect(page.getByText(/此分类目前已停用/)).toBeVisible();
 await page.getByLabel('启用入口',{exact:true}).uncheck();
 await expect(entryButton(page,'运营知识')).toContainText('已停用');
});

test('removes shortcut only and persists an intentionally empty or all-hidden configuration',async({page})=>{
 const writes:NavigationWrite[]=[];await page.route('**/api/admin/navigation',r=>{const write=r.request().postDataJSON();writes.push(write);return r.fulfill({json:ack(write)});});
 await mount(page,{initial:{version:3,entries:[{...home,enabled:false}]},categories});
 await expect(page.getByText('全部快捷入口已停用。固定系统入口仍保留。')).toBeVisible();
 await page.getByRole('button',{name:'保存导航',exact:true}).click();await expect(page.getByRole('status')).toContainText('全部快捷入口已隐藏');
 await page.getByRole('button',{name:'移除此入口',exact:true}).click();await expect(page.getByText('没有快捷入口。保存空配置后，员工只保留固定系统入口。')).toBeVisible();
 await page.getByRole('button',{name:'保存导航',exact:true}).click();await expect(page.getByRole('status')).toContainText('固定首页与退出入口仍保留');
 expect(writes[1]).toEqual({expectedVersion:4,entries:[]});await expect(page.locator('.navigation-settings-item')).toHaveCount(0);
});

test('uncertain acknowledgement locks exact payload and retries identical newly allocated identifiers',async({page})=>{
 const writes:NavigationWrite[]=[];await page.route('**/api/admin/navigation',r=>{const write=r.request().postDataJSON();writes.push(write);return r.fulfill({json:{config:{...ack(write).config,version:writes.length===1?99:2}}});});
 await mount(page);await page.getByRole('button',{name:'添加入口',exact:true}).click();await page.getByLabel('入口名称',{exact:true}).fill('稳定的新入口');
 await page.getByRole('button',{name:'保存导航',exact:true}).click();await expect(page.getByRole('alert')).toContainText('无法确认');
 await expect(page.getByLabel('入口名称',{exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'添加入口',exact:true})).toBeDisabled();await expect(page.getByRole('link',{name:'设置变更记录'})).not.toHaveAttribute('href');
 await page.getByRole('button',{name:'重试原提交',exact:true}).click();await expect(page.getByRole('status')).toContainText('已保存');expect(writes).toHaveLength(2);expect(writes[0]).toEqual(writes[1]);
});

test('repeated conflicts preserve cumulative input backups and restoring rebases only the expected version',async({page})=>{
 const writes:NavigationWrite[]=[];let reads=0;
 await page.route('**/api/admin/navigation',r=>{
  if(r.request().method()==='GET'){reads++;return r.fulfill({json:{config:{version:reads===1?3:5,entries:[{...home,label:reads===1?'服务器 A':'服务器 B'}]}}});}
  const write=r.request().postDataJSON();writes.push(write);return writes.length<=2?r.fulfill({status:409,json:{error:'NAVIGATION_CONFLICT'}}):r.fulfill({json:ack(write)});
 });
 await page.route('**/api/admin/categories',r=>r.fulfill({json:categories}));await mount(page);
 page.on('dialog',dialog=>dialog.accept());
 for(const label of ['第一轮本地输入','第二轮本地输入']){
  await page.getByLabel('入口名称',{exact:true}).fill(label);await page.getByRole('button',{name:'保存导航',exact:true}).click();await expect(page.getByRole('alert')).toContainText('已有新版本');
  await page.getByRole('button',{name:'保留备份并载入最新设置',exact:true}).click();await expect(page.getByRole('status')).toContainText('已载入最新');
 }
 await expect(page.getByLabel('配置备份 1',{exact:true})).toContainText('第一轮本地输入');await expect(page.getByLabel('配置备份 2',{exact:true})).toContainText('第二轮本地输入');
 await page.getByRole('button',{name:'将备份 1 放回编辑区',exact:true}).click();await expect(page.getByLabel('入口名称',{exact:true})).toHaveValue('第一轮本地输入');
 await page.getByRole('button',{name:'保存导航',exact:true}).click();await expect(page.getByRole('status')).toContainText('已保存');expect(writes[2].expectedVersion).toBe(5);expect(writes[2].entries[0].label).toBe('第一轮本地输入');
 await expect(page.getByLabel('配置备份 2',{exact:true})).toContainText('第二轮本地输入');
 expect(await page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;})).toBe(true);
});

test('unknown then conflict stays uncertain and failed reload preserves pending until a complete reload',async({page})=>{
 let writes=0,categoryReads=0;
 await page.route('**/api/admin/navigation',r=>r.request().method()==='GET'?r.fulfill({json:{config:{version:4,entries:[{...home,label:'服务器当前入口'}]}}}):++writes===1?r.fulfill({status:503}):r.fulfill({status:409,json:{error:'NAVIGATION_CONFLICT'}}));
 await page.route('**/api/admin/categories',r=>++categoryReads===1?r.fulfill({status:503}):r.fulfill({json:categories}));
 await mount(page);await page.getByLabel('入口名称',{exact:true}).fill('原提交名称');await page.getByRole('button',{name:'保存导航',exact:true}).click();await page.getByRole('button',{name:'重试原提交',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('仍无法确认此前是否保存成功');page.on('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'保留备份并载入最新设置',exact:true}).click();await expect(page.getByRole('alert')).toContainText('无法完整载入');await expect(page.getByLabel('入口名称',{exact:true})).toHaveValue('原提交名称');await expect(page.getByLabel('入口名称',{exact:true})).toBeDisabled();
 await expect(page.getByLabel('配置备份 1',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'保留备份并载入最新设置',exact:true}).click();await expect(page.getByLabel('入口名称',{exact:true})).toHaveValue('服务器当前入口');await expect(page.getByLabel('入口名称',{exact:true})).toBeEnabled();
 await expect(page.getByRole('status')).toContainText('此前是否曾保存仍无法确认');await expect(page.getByLabel('配置备份 1',{exact:true})).toContainText('原提交名称');await expect(page.getByLabel('配置备份 1',{exact:true})).toContainText('"pending": {');
});

test('dirty edits guard navigation and stay intact while switching between entries',async({page})=>{
 await mount(page);await page.getByLabel('入口名称',{exact:true}).fill('未保存入口');await entryButton(page,'运营知识').click();await entryButton(page,'未保存入口').click();await expect(page.getByLabel('入口名称',{exact:true})).toHaveValue('未保存入口');
 page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('link',{name:'设置变更记录'}).click();await expect(page).toHaveURL(/__navigation_settings_fixture$/);
 expect(await page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;})).toBe(true);
});

test('unconfigured default, persisted empty, unavailable and denied are distinct',async({page})=>{
 await mount(page,{initial:{version:0,entries:defaultNavigationEntries},categories});await expect(page.getByText('正在使用系统默认入口，尚未保存自定义导航。')).toBeVisible();await expect(page.locator('.navigation-settings-item')).toHaveCount(7);
 await page.unrouteAll();await mount(page,{initial:{version:2,entries:[]},categories});await expect(page.getByText('没有快捷入口。保存空配置后，员工只保留固定系统入口。')).toBeVisible();await expect(page.getByText(/正在使用系统默认入口/)).toHaveCount(0);
 await page.unrouteAll();await mount(page,{categories});await expect(page.getByText('导航设置暂时不可用')).toBeVisible();await expect(page.getByRole('button',{name:'添加入口',exact:true})).toHaveCount(0);
 await page.unrouteAll();await mount(page,{initial,categories,state:'denied'});await expect(page.getByText('没有管理权限')).toBeVisible();await expect(page.locator('.navigation-settings-item')).toHaveCount(0);
});

test('real navigation admin APIs and page refuse an unconfigured or forged administrator',async({page,request})=>{
 const response=await request.get('/api/admin/navigation',{headers:{'x-role':'admin'}});expect(response.status()).toBe(503);expect(response.headers()['cache-control']).toBe('private, no-store');
 const saved=await request.put('/api/admin/navigation',{headers:{'x-role':'admin'},data:{expectedVersion:0,entries:[]}});expect(saved.status()).toBe(503);
 await page.goto('/admin/settings/navigation');await expect(page).toHaveURL(/\/admin\/sign-in$/);
});
