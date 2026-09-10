import {test,expect,type Page} from '@playwright/test';
import {editorBrowserBundle,editorFixture} from '../helpers/editor-browser';
import type {EditorData} from '../../src/editor/contract';
let bundle:Awaited<ReturnType<typeof editorBrowserBundle>>;
test.beforeAll(async()=>{bundle=await editorBrowserBundle();});
async function mount(page:Page,initial:()=>EditorData|null,newReference:boolean|'qa'=false){
 await page.route(url=>url.pathname==='/__editor_fixture'||url.pathname==='/admin/editor',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.css}</style></head><body><main class="editor-main"><h1>文章编辑 · 本地样例</h1><script type="application/json" id="data">${JSON.stringify(initial()).replace(/</g,'\\u003c')}</script><div id="editor"></div><a href="/leaving">离开编辑页</a></main><script>${bundle.script.replace(/<\/script/gi,'<\\/script')}</script></body></html>`}));
 await page.goto('/__editor_fixture'+(newReference==='qa'?'?kind=qa':newReference?'?kind=reference':''));await expect(page.locator('.bn-editor')).toBeVisible();
}
async function typeText(page:Page,text:string){const area=page.locator('.bn-editor[contenteditable="true"]');await area.click();await area.press('ControlOrMeta+End');await page.keyboard.insertText(text);}
test('real BlockNote edits autosave reload and mixed blocks preview in order',async({page},info)=>{
 let saved=structuredClone(editorFixture);let writes=0;
 await page.route('**/api/admin/editor/*',async route=>{const value=route.request().postDataJSON();expect(value.expectedSequence).toBe(saved.sequence);saved={...saved,...value,sequence:saved.sequence+1};writes++;await route.fulfill({json:saved});});
 await mount(page,()=>saved);await typeText(page,' 中文更新');await expect(page.getByRole('status')).toContainText('所有修改已保存',{timeout:8000});expect(writes).toBeGreaterThan(0);
 await page.getByRole('button',{name:'提示框',exact:true}).click();const fields=page.locator('.editor-embedded').last();await fields.getByText('编辑此内容块',{exact:true}).click();await fields.locator('textarea').fill('核对二审');await expect(page.getByRole('status')).toContainText('所有修改已保存',{timeout:8000});
 await page.getByRole('button',{name:'预览草稿',exact:true}).click();await expect(page.locator('.editor-preview')).toContainText('中文更新');await expect(page.locator('.editor-preview')).toContainText('核对二审');
 await page.reload();await expect(page.locator('.bn-editor')).toContainText('中文更新');await expect(page.locator('.editor-embedded')).toHaveCount(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`output/verification/editor-${info.project.name}.png`,fullPage:true});await page.evaluate(()=>document.documentElement.dataset.theme='dark');await page.locator('.editor-canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`output/verification/editor-dark-${info.project.name}.png`,fullPage:false});
});
test('typing during an outstanding save is retained and saved with the acknowledged sequence',async({page})=>{
 let release!:()=>void;const pending=new Promise<void>(r=>release=r);const calls:Record<string,unknown>[]=[];let saved=structuredClone(editorFixture);
 await page.route('**/api/admin/editor/*',async route=>{const v=route.request().postDataJSON();calls.push(v);if(calls.length===1)await pending;saved={...saved,...v,sequence:saved.sequence+1};await route.fulfill({json:saved});});
 await mount(page,()=>saved);await page.getByLabel('文章标题',{exact:true}).fill('第一段修改');await expect.poll(()=>calls.length,{timeout:6000}).toBe(1);
 await page.getByLabel('文章标题',{exact:true}).fill('发送期间继续修改');release();await expect(page.getByLabel('文章标题',{exact:true})).toHaveValue('发送期间继续修改');await expect.poll(()=>calls.length,{timeout:8000}).toBe(2);await expect(page.getByRole('status')).toContainText('所有修改已保存');expect(calls[1].expectedSequence).toBe(4);expect(saved.title).toBe('发送期间继续修改');
});
test('failed save retains content pauses retries and warns before leaving',async({page})=>{
 let fail=true,writes=0;let saved=structuredClone(editorFixture);
 await page.route('**/api/admin/editor/*',async route=>{writes++;if(fail)return route.fulfill({status:503,json:{error:'EDITOR_UNAVAILABLE'}});saved={...saved,...route.request().postDataJSON(),sequence:saved.sequence+1};await route.fulfill({json:saved});});
 await mount(page,()=>saved);await typeText(page,' 保留输入');await expect(page.getByRole('status')).toContainText('保存尚未确认',{timeout:6000});expect(writes).toBe(1);
 page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('link',{name:'离开编辑页'}).click();await expect(page.locator('.bn-editor')).toContainText('保留输入');
 fail=false;await page.getByRole('button',{name:'重试保存'}).click();await expect(page.getByRole('status')).toContainText('所有修改已保存');expect(writes).toBe(2);
});
test('new document uses stable id and frozen review document cannot be edited',async({page})=>{
 let saved:EditorData|null=null;let requested='';
 await page.route('**/api/admin/editor/*',async route=>{requested=new URL(route.request().url()).pathname.split('/').pop()!;const v=route.request().postDataJSON();expect(v.expectedSequence).toBe(null);saved={...editorFixture,...v,documentId:requested,sequence:0};await route.fulfill({json:saved});});
 await mount(page,()=>saved);await page.getByLabel('文章标题',{exact:true}).fill('新建内部资料');await expect(page.getByRole('status')).toContainText('所有修改已保存',{timeout:8000});expect(requested).toMatch(/^[a-f0-9-]{36}$/);await expect(page).toHaveURL(new RegExp(`article=${requested}`));
 saved={...saved!,status:'in_review'};await page.reload();await expect(page.getByLabel('文章标题',{exact:true})).toBeDisabled();await expect(page.locator('.bn-editor')).toHaveAttribute('contenteditable','false');await expect(page.getByRole('button',{name:'立即保存'})).toBeDisabled();
});
test('conflict does not overwrite typed input and plain URL text does not embed remote media',async({page})=>{
 await page.route('**/api/admin/editor/*',route=>route.fulfill({status:409,json:{error:'CONFLICT'}}));await mount(page,()=>editorFixture);await typeText(page,' https://company.test/image.png ');await expect(page.getByRole('status')).toContainText('不会覆盖服务器版本',{timeout:8000});await expect(page.locator('.bn-editor')).toContainText('https://company.test/image.png');await expect(page.locator('.bn-editor img')).toHaveCount(0);await expect(page.locator('.bn-editor a[href]')).toHaveCount(0);
});
test('real editor pages and GET PUT reject unconfigured forged identity',async({request,page})=>{
 for(const method of ['get','put'] as const){const r=await request[method]('/api/admin/editor/00000000-0000-4000-8000-000000000031',{headers:{'x-role':'admin','x-user-id':'admin'},...(method==='put'?{data:{expectedSequence:null,title:'forged'}}:{})});expect(r.status()).toBe(503);expect(r.headers()['cache-control']).toBe('private, no-store');}
 await page.goto('/admin/editor');await expect(page.locator('.bn-editor')).toHaveCount(0);
});
test('invalid custom field stays editable and can be corrected without losing its text',async({page})=>{
 let saved=structuredClone(editorFixture);
 await page.route('**/api/admin/editor/*',async route=>{saved={...saved,...route.request().postDataJSON(),sequence:saved.sequence+1};await route.fulfill({json:saved});});
 await mount(page,()=>saved);await page.getByRole('button',{name:'代码框',exact:true}).click();const block=page.locator('.editor-embedded');await block.getByText('编辑此内容块',{exact:true}).click();await block.getByRole('textbox',{name:'代码内容',exact:true}).fill('print("保留代码")');await block.getByRole('textbox',{name:'代码语言',exact:true}).fill('python 3');await expect(block.getByRole('alert')).toBeVisible();await expect(block.getByRole('textbox',{name:'代码内容',exact:true})).toHaveValue('print("保留代码")');await expect(page.getByRole('button',{name:'立即保存'})).toBeDisabled();await block.getByRole('textbox',{name:'代码语言',exact:true}).fill('python');await expect(page.getByRole('status')).toContainText('所有修改已保存',{timeout:8000});await page.reload();await page.locator('.editor-embedded').getByText('编辑此内容块',{exact:true}).click();await expect(page.getByRole('textbox',{name:'代码内容',exact:true})).toHaveValue('print("保留代码")');
});
test('recovery compares server content preserves local input and adopts the server sequence explicitly',async({page},info)=>{
 let server={...editorFixture,title:'服务器最新标题',body:'另一位管理员的正文',sequence:4};let writes=0;
 await page.route('**/api/admin/editor/*',async route=>{if(route.request().method()==='GET')return route.fulfill({json:server});writes++;const v=route.request().postDataJSON();if(v.expectedSequence!==server.sequence)return route.fulfill({status:409,json:{error:'CONFLICT'}});server={...server,...v,sequence:server.sequence+1};await route.fulfill({json:server});});
 await mount(page,()=>editorFixture);await typeText(page,' 我的未保存文字');await expect(page.locator('.editor-save-bar')).toContainText('不会覆盖服务器版本');
 await page.getByRole('button',{name:'读取服务器最新版本',exact:true}).click();await expect(page.getByRole('region',{name:'服务器版本'})).toContainText('另一位管理员的正文');await expect(page.locator('.bn-editor')).toContainText('我的未保存文字');expect(writes).toBe(1);
 await page.getByRole('region',{name:'保存恢复'}).scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`output/verification/recovery-${info.project.name}.png`,fullPage:false});
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'保留备份并载入此版本'}).click();await expect(page.locator('.bn-editor')).toContainText('我的未保存文字');
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'保留备份并载入此版本'}).click();await expect(page.getByLabel('文章标题',{exact:true})).toHaveValue('服务器最新标题');await expect(page.locator('.bn-editor')).toContainText('另一位管理员的正文');
 await page.getByText('载入前的输入备份 1',{exact:true}).click();await expect(page.getByLabel('载入前的输入备份 1',{exact:true})).toContainText('我的未保存文字');expect(writes).toBe(1);
 await page.getByLabel('文章标题',{exact:true}).fill('合并整理后标题');await expect.poll(()=>server.sequence,{timeout:8000}).toBe(5);await expect(page.locator('.editor-save-bar')).toContainText('所有修改已保存');expect(writes).toBe(2);
 page.once('dialog',d=>d.dismiss());await page.getByRole('link',{name:'离开编辑页'}).click();await expect(page.getByLabel('载入前的输入备份 1',{exact:true})).toBeVisible();
});
test('recovery read failure wrong article and clipboard failure retain input without allowing adoption',async({page})=>{
 let reply='failure';await page.route('**/api/admin/editor/*',route=>route.request().method()==='PUT'?route.fulfill({status:409,json:{error:'CONFLICT'}}):reply==='failure'?route.fulfill({status:403,json:{error:'FORBIDDEN'}}):route.fulfill({json:{...editorFixture,documentId:'wrong',sequence:4}}));
 await mount(page,()=>editorFixture);await typeText(page,' 不可丢失');await expect(page.getByRole('region',{name:'保存恢复'})).toBeVisible();await page.getByRole('button',{name:'读取服务器最新版本'}).click();await expect(page.getByRole('alert')).toContainText('没有管理权限');await expect(page.getByRole('region',{name:'服务器版本'})).toHaveCount(0);
 reply='wrong';await page.getByRole('button',{name:'读取服务器最新版本'}).click();await expect(page.getByRole('alert')).toContainText('未读取成功');await expect(page.getByRole('button',{name:'保留备份并载入此版本'})).toHaveCount(0);
 await page.getByText('当前输入备份',{exact:true}).click();await page.evaluate(()=>Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:()=>Promise.reject(new Error('denied'))}));await page.getByRole('button',{name:'复制这份备份'}).click();await expect(page.getByText('复制未成功，请选中上方文字手动复制。')).toBeVisible();await expect(page.getByLabel('当前输入备份',{exact:true})).toContainText('不可丢失');
});
test('recovery of a submitted snapshot locks editing and preserves previous input',async({page})=>{
 const latest={...editorFixture,sequence:4,status:'in_review'};await page.route('**/api/admin/editor/*',r=>r.request().method()==='GET'?r.fulfill({json:latest}):r.fulfill({status:409,json:{error:'INVALID_STATE'}}));
 await mount(page,()=>editorFixture);await typeText(page,' 审核前输入');await expect(page.getByRole('region',{name:'保存恢复'})).toBeVisible();await page.getByRole('button',{name:'读取服务器最新版本'}).click();await expect(page.getByRole('region',{name:'服务器版本'})).toContainText('等待审核');page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'保留备份并载入此版本'}).click();await expect(page.locator('.bn-editor')).toHaveAttribute('contenteditable','false');await expect(page.getByRole('button',{name:'立即保存'})).toBeDisabled();await page.getByText('载入前的输入备份 1',{exact:true}).click();await expect(page.getByLabel('载入前的输入备份 1',{exact:true})).toContainText('审核前输入');
});
test('server changing after comparison still conflicts and a second recovery retains both inputs',async({page})=>{
 let server={...editorFixture,sequence:4,title:'第一次服务器标题'};const sequences:number[]=[];
 await page.route('**/api/admin/editor/*',route=>{if(route.request().method()==='GET')return route.fulfill({json:server});sequences.push(route.request().postDataJSON().expectedSequence);return route.fulfill({status:409,json:{error:'CONFLICT'}});});
 await mount(page,()=>editorFixture);await page.getByLabel('文章标题',{exact:true}).fill('第一份本地输入');await expect(page.getByRole('region',{name:'保存恢复'})).toBeVisible();await page.getByRole('button',{name:'读取服务器最新版本'}).click();await expect(page.getByRole('region',{name:'服务器版本'})).toContainText('服务器版本 4');
 server={...server,sequence:5,title:'又被更新的服务器标题'};page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'保留备份并载入此版本'}).click();await page.getByLabel('文章标题',{exact:true}).fill('第二份本地输入');await expect(page.getByRole('region',{name:'保存恢复'})).toBeVisible();expect(sequences).toEqual([3,4]);
 await page.getByRole('button',{name:'读取服务器最新版本'}).click();await expect(page.getByRole('region',{name:'服务器版本'})).toContainText('服务器版本 5');page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'保留备份并载入此版本'}).click();await page.getByText('载入前的输入备份 1',{exact:true}).click();await page.getByText('载入前的输入备份 2',{exact:true}).click();await expect(page.getByLabel('载入前的输入备份 1',{exact:true})).toContainText('第一份本地输入');await expect(page.getByLabel('载入前的输入备份 2',{exact:true})).toContainText('第二份本地输入');await expect(page.getByLabel('文章标题',{exact:true})).toHaveValue('又被更新的服务器标题');
});
test('editor trash action requires saved input and confirmation then freezes only after acknowledged deletion',async({page})=>{
 let saved=structuredClone(editorFixture);let writes=0;
 await page.route('**/api/admin/editor/*',r=>{saved={...saved,...r.request().postDataJSON(),sequence:saved.sequence+1};return r.fulfill({json:saved});});
 await page.route('**/api/admin/lifecycle/*',r=>{const v=r.request().postDataJSON();expect(v).toEqual({action:'trash',expectedSequence:saved.sequence});writes++;return r.fulfill({json:{documentId:saved.documentId,action:'trash',sequence:saved.sequence+1,cleanupPending:0}});});
 await mount(page,()=>saved);await typeText(page,' 修改后删除');await expect(page.getByRole('button',{name:'删除文章',exact:true})).toBeDisabled();await expect.poll(()=>saved.sequence,{timeout:8000}).toBe(4);await page.getByRole('button',{name:'删除文章',exact:true}).click();await expect(page.getByRole('group',{name:'确认移入回收站'})).toBeVisible();expect(writes).toBe(0);await page.getByRole('button',{name:'取消删除'}).click();expect(writes).toBe(0);await page.getByRole('button',{name:'删除文章',exact:true}).click();await page.getByRole('button',{name:'确认移入回收站',exact:true}).click();await expect(page.getByRole('region',{name:'文章删除'})).toContainText('已移入回收站');await expect(page.locator('.bn-editor')).toHaveAttribute('contenteditable','false');expect(writes).toBe(1);
});
test('upload-in-progress rejection keeps editor data and permits retry after upload completes',async({page})=>{
 await page.route('**/api/admin/lifecycle/*',r=>r.fulfill({status:409,json:{error:'UPLOAD_IN_PROGRESS'}}));await mount(page,()=>editorFixture);await page.getByRole('button',{name:'删除文章',exact:true}).click();await page.getByRole('button',{name:'确认移入回收站',exact:true}).click();await expect(page.getByRole('alert')).toContainText('仍在上传');await expect(page.locator('.bn-editor')).toHaveAttribute('contenteditable','true');await expect(page.getByLabel('文章标题',{exact:true})).toHaveValue(editorFixture.title);
});

test('editing a published article saves a new draft while showing that its old formal version remains readable',async({page})=>{
 let saved:EditorData={...structuredClone(editorFixture),status:'published',publishedRevision:2};
 await page.route('**/api/admin/editor/*',r=>{const value=r.request().postDataJSON();expect(value.expectedSequence).toBe(3);saved={...saved,...value,sequence:4,status:'draft',publishedRevision:2};return r.fulfill({json:saved});});
 await mount(page,()=>saved);await expect(page.getByText('修改会保存为新草稿，旧正式版继续可读；新稿需要重新二审和发布。',{exact:true})).toBeVisible();
 await page.getByLabel('文章标题',{exact:true}).fill('修改后的正式资料');await expect(page.getByRole('status')).toContainText('所有修改已保存',{timeout:8000});await expect(page.getByText('旧正式版 2 仍可阅读',{exact:true})).toBeVisible();expect(saved.status).toBe('draft');expect(saved.publishedRevision).toBe(2);await expect(page.getByRole('link',{name:'归档与下线'})).toHaveAttribute('href','/admin/availability?article=editor-local');
});
test('new OPS documents default to restricted audience and cannot select ordinary staff',async({page})=>{
 let saved:EditorData|null=null;
 await page.route('**/api/admin/editor/*',async route=>{const v=route.request().postDataJSON();expect(v.kind).toBe('ops');expect(v.audience).toBe('ops');saved={...editorFixture,...v,documentId:new URL(route.request().url()).pathname.split('/').pop()!,sequence:0};await route.fulfill({json:saved});});
 await mount(page,()=>null);await page.getByRole('combobox',{name:'资料类型',exact:true}).selectOption('ops');await expect(page.getByRole('combobox',{name:'阅读范围',exact:true})).toHaveValue('ops');await expect(page.getByRole('combobox',{name:'阅读范围',exact:true}).locator('option[value="staff"]')).toHaveCount(0);
 await page.getByLabel('文章标题',{exact:true}).fill('运营资料测试样例');await expect(page.getByRole('status')).toContainText('所有修改已保存',{timeout:8000});await expect(page.getByRole('combobox',{name:'资料类型',exact:true})).toBeDisabled();expect(saved).not.toBeNull();
});

test('Reference shortcut presets a new document but does not change the kind of an existing article',async({page})=>{
 let saved:EditorData|null=null;await page.route('**/api/admin/editor/*',async route=>{const v=route.request().postDataJSON();expect(v.kind).toBe('reference');saved={...editorFixture,...v,documentId:new URL(route.request().url()).pathname.split('/').pop()!,sequence:0};await route.fulfill({json:saved});});
 await mount(page,()=>null,true);await expect(page.getByRole('combobox',{name:'资料类型',exact:true})).toHaveValue('reference');await page.getByLabel('文章标题',{exact:true}).fill('速查表测试样例');await expect(page.getByRole('status')).toContainText('所有修改已保存',{timeout:8000});expect(saved).not.toBeNull();
 await page.unrouteAll();await mount(page,()=>editorFixture,true);await expect(page.getByRole('combobox',{name:'资料类型',exact:true})).toHaveValue(editorFixture.kind);await expect(page.getByRole('combobox',{name:'资料类型',exact:true})).toBeDisabled();
});


test('Q&A shortcut saves classification and order as draft metadata and preserves them on reload',async({page},info)=>{
 let saved:EditorData|null=null;
 await page.route('**/api/admin/editor/*',async r=>{const v=r.request().postDataJSON();saved={...editorFixture,...v,documentId:new URL(r.request().url()).pathname.split('/').pop()!,sequence:saved?saved.sequence+1:0};return r.fulfill({json:saved});});
 await mount(page,()=>saved,'qa');await expect(page.getByRole('combobox',{name:'资料类型',exact:true})).toHaveValue('qa');
 await page.getByLabel('问答分类',{exact:true}).fill('账户问题');await page.getByLabel('问答排序',{exact:true}).fill('12');await page.getByLabel('文章标题',{exact:true}).fill('如何核对账户？');
 await expect(page.getByRole('status')).toContainText('所有修改已保存',{timeout:8000});expect(saved).toMatchObject({kind:'qa',qa:{category:'账户问题',position:12}});
 await page.reload();await expect(page.getByLabel('问答分类',{exact:true})).toHaveValue('账户问题');await expect(page.getByLabel('问答排序',{exact:true})).toHaveValue('12');
 await page.getByLabel('问答排序',{exact:true}).fill('-1');await expect(page.getByRole('alert')).toContainText('格式或长度');await expect(page.getByRole('button',{name:'立即保存',exact:true})).toBeDisabled();
 await page.getByLabel('问答排序',{exact:true}).fill('5');await expect(page.getByRole('status')).toContainText('所有修改已保存',{timeout:8000});expect(saved).toMatchObject({qa:{category:'账户问题',position:5}});
 await page.screenshot({path:`output/verification/qa-editor-${info.project.name}.png`,fullPage:true});
});
test('Q&A classification freezes in review and the shortcut never changes an existing kind',async({page})=>{
 await mount(page,()=>({...editorFixture,kind:'qa',qa:{category:'既有分类',position:4},status:'in_review'}),'qa');await expect(page.getByLabel('问答分类',{exact:true})).toBeDisabled();await expect(page.getByLabel('问答排序',{exact:true})).toBeDisabled();
 await page.unrouteAll();await mount(page,()=>editorFixture,'qa');await expect(page.getByRole('combobox',{name:'资料类型',exact:true})).toHaveValue('article');await expect(page.getByLabel('问答分类',{exact:true})).toHaveCount(0);
});

test('Q&A recovery keeps classification input and displays the server version before explicit replacement',async({page})=>{
 const initial:EditorData={...editorFixture,kind:'qa',qa:{category:'原分类',position:1}};const latest:EditorData={...initial,sequence:4,qa:{category:'服务器分类',position:6}};
 await page.route('**/api/admin/editor/*',r=>r.request().method()==='GET'?r.fulfill({json:latest}):r.fulfill({status:409,json:{error:'CONFLICT'}}));await mount(page,()=>initial);
 await page.getByLabel('问答分类',{exact:true}).fill('本地分类');await expect(page.getByRole('region',{name:'保存恢复'})).toBeVisible();await page.getByRole('button',{name:'读取服务器最新版本'}).click();await expect(page.getByRole('region',{name:'服务器版本'})).toContainText('服务器分类');await expect(page.getByLabel('问答分类',{exact:true})).toHaveValue('本地分类');
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'保留备份并载入此版本'}).click();await expect(page.getByLabel('问答分类',{exact:true})).toHaveValue('服务器分类');await expect(page.getByLabel('问答排序',{exact:true})).toHaveValue('6');await page.getByText('载入前的输入备份 1',{exact:true}).click();await expect(page.getByLabel('载入前的输入备份 1',{exact:true})).toContainText('本地分类');
});

test('Q&A mismatched save metadata is not acknowledged and exact retry preserves the submitted values',async({page})=>{
 const initial:EditorData={...editorFixture,kind:'qa',qa:{category:'原分类',position:1}};const writes:Record<string,unknown>[]=[];
 await page.route('**/api/admin/editor/*',r=>{const v=r.request().postDataJSON();writes.push(v);return r.fulfill({json:{...initial,...v,sequence:4,qa:writes.length===1?{category:'错误回执',position:99}:v.qa}});});await mount(page,()=>initial);
 await page.getByLabel('问答分类',{exact:true}).fill('新的分类');await expect(page.getByRole('status')).toContainText('保存尚未确认',{timeout:8000});expect(writes).toHaveLength(1);await expect(page.getByLabel('问答分类',{exact:true})).toHaveValue('新的分类');await page.getByRole('button',{name:'重试保存',exact:true}).click();await expect(page.getByRole('status')).toContainText('所有修改已保存');expect(writes).toHaveLength(2);expect(writes[1]).toEqual(writes[0]);expect(writes[1].qa).toEqual({category:'新的分类',position:1});
});
