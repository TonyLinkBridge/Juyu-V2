import {test,expect,type Page} from '@playwright/test';
import {editorBrowserBundle,editorFixture} from '../helpers/editor-browser';
import {decisionBrowserBundle,decisionFixture} from '../helpers/decision-browser';
import type {EditorData} from '../../src/editor/contract';
import type {CategoryDefinition} from '../../src/categories/model';
let bundle:Awaited<ReturnType<typeof editorBrowserBundle>>,decision:Awaited<ReturnType<typeof decisionBrowserBundle>>;
test.beforeAll(async()=>{bundle=await editorBrowserBundle();decision=await decisionBrowserBundle();});
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const defs:CategoryDefinition[]=[{id:id(1),version:1,name:'普通流程',parentId:null,position:0,enabled:true,audience:'staff'},{id:id(2),version:1,name:'运营内部',parentId:null,position:1,enabled:true,audience:'ops'},{id:id(3),version:1,name:'异常处理',parentId:id(2),position:0,enabled:true,audience:'staff'},{id:id(4),version:1,name:'已停用分类',parentId:null,position:2,enabled:false,audience:'staff'}];
async function mount(page:Page,initial:EditorData){await page.route(url=>url.pathname==='/__category_editor',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.css}</style></head><body><main class="editor-main"><h1>分类编辑 · 本地样例</h1><script type="application/json" id="data">${JSON.stringify(initial).replace(/</g,'\\u003c')}</script><div id="editor"></div></main><script>${bundle.script.replace(/<\/script/gi,'<\\/script')}</script></body></html>`}));await page.goto('/__category_editor');await expect(page.locator('.bn-editor')).toBeVisible();}
test('draft category choices persist with stable IDs and inherited access hints',async({page},info)=>{
 let saved:EditorData={...editorFixture,categoryOptions:defs,categoryIds:[id(1)]};await page.route('**/api/admin/editor/*',r=>{const input=r.request().postDataJSON();saved={...saved,...input,sequence:input.expectedSequence+1};return r.fulfill({json:saved});});
 await mount(page,saved);await page.getByRole('button',{name:/分类：普通流程/}).click();await expect(page.getByRole('checkbox',{name:/已停用分类/})).toBeDisabled();
 await page.getByRole('checkbox',{name:/普通流程/}).uncheck();await page.getByRole('checkbox',{name:/运营内部 \/ 异常处理/}).check();
 await expect(page.getByRole('status')).toContainText('所有修改已保存',{timeout:8000});expect(saved.categoryIds).toEqual([id(3)]);
 await expect(page.getByRole('checkbox',{name:/运营内部 \/ 异常处理/})).toHaveAccessibleName(/运营和管理员/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`output/verification/categories-editor-${info.project.name}.png`,fullPage:true,animations:'disabled'});
});
test('article directory icon saves with the editor draft',async({page})=>{
 let saved:EditorData={...editorFixture,iconKey:null};
 await page.route('**/api/admin/editor/*',r=>{const input=r.request().postDataJSON();saved={...saved,...input,sequence:input.expectedSequence+1};return r.fulfill({json:saved});});
 await mount(page,saved);
 await page.getByRole('button',{name:'文章设置',exact:true}).click();
 await page.getByRole('button',{name:/阅读范围与资料/}).click();
 await page.getByRole('combobox',{name:'文章目录图标'}).selectOption('lightbulb');
 await expect(page.getByRole('status')).toContainText('所有修改已保存',{timeout:8000});
 expect(saved.iconKey).toBe('lightbulb');
});
test('old disabled assignments can be retained or removed and rejected save keeps new choices',async({page})=>{
 const initial={...editorFixture,categoryOptions:defs,categoryIds:[id(4)]};await page.route('**/api/admin/editor/*',r=>r.fulfill({status:409,json:{error:'CONFLICT'}}));await mount(page,initial);await page.getByRole('button',{name:/分类：已停用分类/}).click();
 await expect(page.getByRole('checkbox',{name:/已停用分类/})).toBeChecked();await page.getByRole('checkbox',{name:/已停用分类/}).uncheck();await page.getByRole('checkbox',{name:/普通流程/}).check();
 await expect(page.getByRole('status')).toContainText('另一位管理员',{timeout:8000});await expect(page.getByRole('checkbox',{name:/普通流程/})).toBeChecked();await expect(page.getByRole('checkbox',{name:/已停用分类/})).not.toBeChecked();
});
test('wrong category acknowledgment never shows saved and retries the identical submission',async({page})=>{
 const writes:unknown[]=[];await page.route('**/api/admin/editor/*',r=>{const input=r.request().postDataJSON();writes.push(input);return r.fulfill({json:{...editorFixture,...input,documentId:'editor-local',sequence:input.expectedSequence+1,categoryOptions:defs,categoryIds:[]}});});await mount(page,{...editorFixture,categoryOptions:defs,categoryIds:[]});await page.getByRole('button',{name:'添加分类'}).click();await page.getByRole('checkbox',{name:/普通流程/}).check();
 await expect(page.getByRole('status')).toContainText('保存尚未确认',{timeout:8000});await expect(page.getByRole('status')).not.toContainText('所有修改已保存');await page.getByRole('button',{name:'关闭文章设置'}).click();await page.getByRole('button',{name:'重试保存'}).click();await expect.poll(()=>writes.length).toBe(2);expect(writes[1]).toEqual(writes[0]);
});
test('second review displays saved category scope and frozen editor preserves sent assignment',async({page})=>{
 const article={...decisionFixture.article,categoryOptions:defs,categoryIds:[id(3)]};await page.route('**/__category_review',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${decision.css}</style></head><body><main><script type="application/json" id="data">${JSON.stringify({...decisionFixture,article}).replace(/</g,'\\u003c')}</script><div id="review"></div></main><script>${decision.script.replace(/<\/script/gi,'<\\/script')}</script></body></html>`}));await page.goto('/__category_review');await expect(page.getByRole('region',{name:'文章目录分类'})).toContainText('运营内部 / 异常处理 · 运营和管理员');
 await mount(page,article);await page.getByRole('button',{name:/分类：异常处理/}).click();await expect(page.getByRole('region',{name:'文章目录分类'})).toContainText('运营内部 / 异常处理');await expect(page.getByRole('checkbox',{name:/异常处理/})).toHaveCount(0);
});
