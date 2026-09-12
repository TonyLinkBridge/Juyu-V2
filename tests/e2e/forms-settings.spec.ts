import {queueConfirmation,settleConfirmation} from '../helpers/site-confirmation';
import {test,expect,type Page} from '@playwright/test';
import {formsSettingsBrowserBundle} from '../helpers/forms-settings-browser';
import type {FormDefinition,FormWrite} from '../../src/forms/model';
import type {FieldDefinition} from '../../src/fields/model';
let bundle:Awaited<ReturnType<typeof formsSettingsBrowserBundle>>;
test.beforeAll(async()=>{bundle=await formsSettingsBrowserBundle();});
const team:FieldDefinition={id:'00000000-0000-4000-8000-000000000061',version:1,name:'所属团队',type:'select',required:false,enabled:true,options:['运营','客服']};
const latestTeam:FieldDefinition={...team,version:2,name:'业务团队',options:['运营','客服','财务']};
const reason:FieldDefinition={...team,id:'00000000-0000-4000-8000-000000000062',name:'申请说明',type:'text',options:[]};
const latestReason:FieldDefinition={...reason,version:2,enabled:false};
const date:FieldDefinition={...reason,id:'00000000-0000-4000-8000-000000000063',name:'开始日期',type:'date'};
const definitions=[latestTeam,latestReason,date];
const form:FormDefinition={id:'00000000-0000-4000-8000-000000000050',version:1,title:'入职申请',description:'填写后由管理员处理。',audience:'staff',enabled:true,fields:[{field:team,required:true,width:'half'},{field:reason,required:false,width:'half'}]};
const other:FormDefinition={...form,id:'00000000-0000-4000-8000-000000000051',title:'其他申请',enabled:false};
const snapshots=[team,latestTeam,reason,latestReason,date];
function ack(url:string,write:FormWrite){const {expectedVersion,fields,...rest}=write;return {...rest,id:new URL(url).pathname.split('/').pop(),version:(expectedVersion??0)+1,fields:fields.map(item=>({field:snapshots.find(field=>field.id===item.id&&field.version===item.version),required:item.required,width:item.width}))};}
async function mount(page:Page,props:unknown={initial:[form,other],definitions}){
 await page.route('**/__forms_settings_fixture',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.css}</style></head><body><header>表单设置 · 本地测试样例（非真实公司配置）</header><main><div id="forms-settings"></div></main><script id="data" type="application/json">${JSON.stringify(props).replace(/</g,'\\u003c')}</script><script>${bundle.script.replace(/<\/script/gi,'<\\/script')}</script></body></html>`}));
 await page.goto('/__forms_settings_fixture');
}
function binding(page:Page,field:FieldDefinition){return page.locator(`.form-settings-bindings [data-field-id="${field.id}"]`);}
async function add(page:Page,field:FieldDefinition){await page.getByLabel('添加字段',{exact:true}).selectOption(field.id);await page.getByRole('button',{name:'添加到表单',exact:true}).click();await settleConfirmation(page);}

test('creates disabled form using current fields, reorders local required/width and previews both themes',async({page},info)=>{
 const writes:FormWrite[]=[];
 await page.route('**/api/admin/forms/*',r=>{const write=r.request().postDataJSON();writes.push(write);return r.fulfill({json:ack(r.request().url(),write)});});
 await mount(page);await page.getByRole('button',{name:'新建表单',exact:true}).click();await settleConfirmation(page);
 await expect(page.getByLabel('启用表单',{exact:true})).not.toBeChecked();
 await expect(page.locator(`#form-add-field option[value="${reason.id}"]`)).toHaveCount(0);
 await page.getByLabel('表单标题',{exact:true}).fill('新员工登记 <script>');
 await page.getByLabel('填写说明',{exact:true}).fill('请填写所属团队和开始日期。');
 await add(page,latestTeam);await add(page,date);
 await binding(page,date).getByRole('button',{name:'上移',exact:true}).click();await settleConfirmation(page);
 await page.getByLabel('开始日期设为必填',{exact:true}).check();
 await page.getByLabel('开始日期布局宽度',{exact:true}).selectOption('half');
 await page.getByLabel('业务团队布局宽度',{exact:true}).selectOption('half');
 await expect(page.locator('.form-settings-preview-fields label').first()).toContainText('开始日期');
 await expect(page.locator('.form-settings-preview-fields label').first()).toContainText('必填');
 await page.getByRole('button',{name:'保存表单',exact:true}).click();await settleConfirmation(page);
 await expect(page.getByRole('status')).toContainText('停用状态');
 expect(writes[0]).toMatchObject({expectedVersion:null,enabled:false,fields:[{id:date.id,version:1,required:true,width:'half'},{id:team.id,version:2,required:false,width:'half'}]});
 const widths=await page.locator('.form-settings-preview-fields').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
 expect(widths).toBe(info.project.name==='mobile'?1:2);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(page.locator('main script')).toHaveCount(0);
 await page.screenshot({path:`output/verification/forms-settings-${info.project.name}.png`,fullPage:true,animations:'disabled'});
 await page.evaluate(()=>document.documentElement.dataset.theme='dark');
 await expect.poll(()=>page.locator('html').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(25, 25, 31)');
 await page.screenshot({path:`output/verification/forms-settings-dark-${info.project.name}.png`,fullPage:true,animations:'disabled'});
});

test('existing bindings retain snapshots until explicit refresh and local required stays independent',async({page})=>{
 const writes:FormWrite[]=[];
 await page.route('**/api/admin/forms/*',r=>{const write=r.request().postDataJSON();writes.push(write);return r.fulfill({json:ack(r.request().url(),write)});});
 await mount(page);await page.getByRole('button',{name:/入职申请/}).click();await settleConfirmation(page);
 await expect(binding(page,team)).toContainText('仍使用原版本');
 await expect(binding(page,reason)).toContainText('目前已停用');
 await expect(page.getByLabel('所属团队（预览）',{exact:true}).locator('option')).toHaveCount(3);
 await page.getByLabel('表单标题',{exact:true}).fill('更新标题');
 await page.getByRole('button',{name:'保存表单',exact:true}).click();await settleConfirmation(page);
 await expect(page.getByRole('status')).toContainText('已保存');
 expect(writes[0].fields.map(item=>item.version)).toEqual([1,1]);
 await binding(page,team).getByRole('button',{name:'更新为最新字段',exact:true}).click();await settleConfirmation(page);
 await expect(page.getByLabel('业务团队设为必填',{exact:true})).toBeChecked();
 await expect(page.getByLabel('业务团队布局宽度',{exact:true})).toHaveValue('half');
 await expect(page.getByLabel('业务团队（预览）',{exact:true}).locator('option')).toHaveCount(4);
 await page.getByRole('button',{name:'保存表单',exact:true}).click();await settleConfirmation(page);
 await expect(page.getByRole('status')).toContainText('已保存');
 expect(writes[1]).toMatchObject({expectedVersion:2,fields:[{id:team.id,version:2,required:true,width:'half'},{id:reason.id,version:1}]});
});

test('disabled global fields can be retained while disabling a form after explicit confirmation',async({page})=>{
 const writes:FormWrite[]=[];
 await page.route('**/api/admin/forms/*',r=>{const write=r.request().postDataJSON();writes.push(write);return r.fulfill({json:ack(r.request().url(),write)});});
 await mount(page,{initial:[form],definitions:definitions.map(field=>({...field,enabled:false}))});
 await page.getByRole('button',{name:/入职申请/}).click();await settleConfirmation(page);
 await expect(page.getByRole('button',{name:'更新为最新字段',exact:true})).toHaveCount(0);
 await page.getByLabel('启用表单',{exact:true}).uncheck();
 queueConfirmation(page,async dialog=>{expect(dialog.message()).toContain('立即生效');await dialog.dismiss();});
 await page.getByRole('button',{name:'保存表单',exact:true}).click();await settleConfirmation(page);expect(writes).toHaveLength(0);
 queueConfirmation(page,dialog=>dialog.accept());await page.getByRole('button',{name:'保存表单',exact:true}).click();await settleConfirmation(page);
 await expect(page.getByRole('status')).toContainText('停用状态');
 expect(writes[0]).toMatchObject({enabled:false,fields:[{id:team.id,version:1},{id:reason.id,version:1}]});
});

test('forged field metadata makes save uncertain, freezes configuration and retries exact original',async({page})=>{
 const writes:{url:string;body:FormWrite}[]=[];
 await page.route('**/api/admin/forms/*',r=>{const write=r.request().postDataJSON();writes.push({url:r.request().url(),body:write});const result=ack(r.request().url(),write);if(writes.length===1)result.fields[0].field={...date,name:'伪造字段名称'};return r.fulfill({json:result});});
 await mount(page);await page.getByRole('button',{name:'新建表单',exact:true}).click();await settleConfirmation(page);
 await page.getByLabel('表单标题',{exact:true}).fill('稳定原提交');await add(page,date);
 await page.getByRole('button',{name:'保存表单',exact:true}).click();await settleConfirmation(page);
 await expect(page.getByRole('alert')).toContainText('无法确认');
 await expect(page.getByLabel('表单标题',{exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'新建表单',exact:true})).toBeDisabled();
 await expect(page.getByRole('link',{name:'设置变更记录'})).not.toHaveAttribute('href');
 await page.getByRole('button',{name:'重试原提交',exact:true}).click();await settleConfirmation(page);
 await expect(page.getByRole('status')).toContainText('已保存');
 expect(writes).toHaveLength(2);expect(writes[0]).toEqual(writes[1]);
});

test('unknown then conflict remains uncertain and explicit reload restores current configuration',async({page})=>{
 let attempts=0;
 await page.route('**/api/admin/forms/*',r=>++attempts===1?r.fulfill({status:503}):r.fulfill({status:409,json:{error:'FORM_CONFLICT'}}));
 await page.route('**/api/admin/forms',r=>r.fulfill({json:[{...form,title:'服务器当前表单',version:5}]}));
 await page.route('**/api/admin/fields',r=>r.fulfill({json:definitions}));
 await mount(page);await page.getByRole('button',{name:/入职申请/}).click();await settleConfirmation(page);
 await page.getByLabel('表单标题',{exact:true}).fill('本地输入');
 await page.getByRole('button',{name:'保存表单',exact:true}).click();await settleConfirmation(page);
 await page.getByRole('button',{name:'重试原提交',exact:true}).click();await settleConfirmation(page);
 await expect(page.getByRole('alert')).toContainText('仍无法确认此前是否保存成功');
 await expect(page.getByLabel('表单标题',{exact:true})).toHaveValue('本地输入');
 queueConfirmation(page,async dialog=>{expect(dialog.message()).toContain('不会撤销');await dialog.accept();});
 await page.getByRole('button',{name:'载入最新设置（替换当前输入）',exact:true}).click();await settleConfirmation(page);
 await expect(page.getByLabel('表单标题',{exact:true})).toHaveValue('服务器当前表单');
 await expect(page.getByLabel('表单标题',{exact:true})).toBeEnabled();
 await expect(page.getByRole('status')).toContainText('此前提交是否曾保存仍无法确认');
});

test('field conflict preserves edits and a partial reload failure updates neither resource',async({page})=>{
 let fieldReads=0;
 await page.route('**/api/admin/forms/*',r=>r.fulfill({status:409,json:{error:'FIELD_CONFLICT'}}));
 await page.route('**/api/admin/forms',r=>r.fulfill({json:[{...form,title:'最新表单',version:4}]}));
 await page.route('**/api/admin/fields',r=>++fieldReads===1?r.fulfill({status:503}):r.fulfill({json:definitions}));
 await mount(page);await page.getByRole('button',{name:/入职申请/}).click();await settleConfirmation(page);
 await page.getByLabel('表单标题',{exact:true}).fill('未保存配置');
 await page.getByRole('button',{name:'保存表单',exact:true}).click();await settleConfirmation(page);
 await expect(page.getByRole('alert')).toContainText('字段版本已有变化');
 await expect(page.getByRole('button',{name:'保存表单',exact:true})).toBeDisabled();
 queueConfirmation(page,dialog=>dialog.accept());
 await page.getByRole('button',{name:'载入最新设置（替换当前输入）',exact:true}).click();await settleConfirmation(page);
 await expect(page.getByRole('alert')).toContainText('无法完整载入');
 await expect(page.getByLabel('表单标题',{exact:true})).toHaveValue('未保存配置');
 await expect(page.getByRole('button',{name:/入职申请/})).toBeVisible();
 await expect(page.getByRole('button',{name:/^最新表单 /})).toHaveCount(0);
 await page.getByRole('button',{name:'载入最新设置（替换当前输入）',exact:true}).click();await settleConfirmation(page);
 await expect(page.getByLabel('表单标题',{exact:true})).toHaveValue('最新表单');
 await expect(binding(page,team).getByRole('button',{name:'更新为最新字段'})).toBeVisible();
});

test('dirty field selections guard close, new, other form, navigation and unload',async({page})=>{
 await mount(page);await page.getByRole('button',{name:/入职申请/}).click();await settleConfirmation(page);
 await page.getByLabel('所属团队设为必填',{exact:true}).uncheck();
 for(const element of [page.getByRole('button',{name:'关闭编辑'}),page.getByRole('button',{name:'新建表单',exact:true}),page.getByRole('button',{name:/其他申请/}),page.getByRole('link',{name:'设置变更记录'})]){
  queueConfirmation(page,dialog=>dialog.dismiss());await element.click();await settleConfirmation(page);await expect(page.getByLabel('表单标题',{exact:true})).toHaveValue('入职申请');await expect(page.getByLabel('所属团队设为必填',{exact:true})).not.toBeChecked();
 }
 expect(await page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;})).toBe(true);
});

test('empty configuration, unavailable and denied remain distinct; empty field list cannot be saved',async({page})=>{
 let writes=0;await page.route('**/api/admin/forms/*',r=>{writes++;return r.fulfill({status:500});});
 await mount(page,{initial:[],definitions:[]});
 await expect(page.getByText('还没有表单。点击“新建表单”添加第一张。')).toBeVisible();
 await page.getByRole('button',{name:'新建表单',exact:true}).click();await settleConfirmation(page);
 await page.getByLabel('表单标题',{exact:true}).fill('无字段');
 await page.getByRole('button',{name:'保存表单',exact:true}).click();await settleConfirmation(page);
 await expect(page.getByRole('alert')).toContainText('1–20');expect(writes).toBe(0);
 queueConfirmation(page,dialog=>dialog.accept());await page.unrouteAll();await mount(page,{initial:[form],definitions,state:'unavailable'});
 await expect(page.getByText('表单设置暂时不可用')).toBeVisible();
 await expect(page.getByRole('button',{name:/入职申请/})).toHaveCount(0);
 await expect(page.getByText('还没有表单。点击“新建表单”添加第一张。')).toHaveCount(0);
 await page.unrouteAll();await mount(page,{initial:[form],definitions,state:'denied'});
 await expect(page.getByText('没有管理权限')).toBeVisible();
 await expect(page.getByRole('button',{name:'新建表单',exact:true})).toHaveCount(0);
});

test('enabling a brand new form requires confirmation and dismissing sends no write',async({page})=>{
 const writes:FormWrite[]=[];
 await page.route('**/api/admin/forms/*',r=>{const write=r.request().postDataJSON();writes.push(write);return r.fulfill({json:ack(r.request().url(),write)});});
 await mount(page);await page.getByRole('button',{name:'新建表单',exact:true}).click();await settleConfirmation(page);
 await page.getByLabel('表单标题',{exact:true}).fill('立即开放的新表单');await add(page,date);
 await page.getByLabel('填写范围',{exact:true}).selectOption('ops');
 await page.getByLabel('启用表单',{exact:true}).check();
 queueConfirmation(page,async dialog=>{expect(dialog.message()).toContain('立即开放的新表单');expect(dialog.message()).toContain('运营和管理员');expect(dialog.message()).toContain('立即生效');await dialog.dismiss();});
 await page.getByRole('button',{name:'保存表单',exact:true}).click();await settleConfirmation(page);
 expect(writes).toHaveLength(0);await expect(page.getByLabel('启用表单',{exact:true})).toBeChecked();
 queueConfirmation(page,dialog=>dialog.accept());await page.getByRole('button',{name:'保存表单',exact:true}).click();await settleConfirmation(page);
 await expect(page.getByRole('status')).toContainText('已保存并启用');
 expect(writes).toHaveLength(1);expect(writes[0]).toMatchObject({expectedVersion:null,audience:'ops',enabled:true});
});
