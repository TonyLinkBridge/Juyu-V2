import {readFile} from 'node:fs/promises';
import {test,expect,type Page} from '@playwright/test';
import {editorBrowserBundle,editorFixture} from '../helpers/editor-browser';
import type {EditorData} from '../../src/editor/contract';
import {decodeEditorBody,encodeEditorBody,editorMedia} from '../../src/editor/document';
let bundle:Awaited<ReturnType<typeof editorBrowserBundle>>;
test.beforeAll(async()=>{bundle=await editorBrowserBundle();});
async function mount(page:Page,initial:()=>EditorData|null,newReference:boolean|'qa'=false){
 await page.route('**/__editor_assets/*.js',async route=>{const file=new URL(route.request().url()).pathname.split('/').pop()!;if(!/^[a-zA-Z0-9_.-]+\.js$/.test(file))return route.abort();return route.fulfill({contentType:'application/javascript',body:await readFile('output/verification/editor-fixture/'+file,'utf8')});});
 await page.route(url=>url.pathname==='/__editor_fixture'||url.pathname==='/admin/editor',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.css}</style></head><body><main class="editor-main"><h1>文章编辑 · 本地样例</h1><script type="application/json" id="data">${JSON.stringify(initial()).replace(/</g,'\\u003c')}</script><div id="editor"></div><a href="/leaving">离开编辑页</a></main><script>${bundle.script.replace(/<\/script/gi,'<\\/script')}</script></body></html>`}));
 await page.goto('/__editor_fixture'+(newReference==='qa'?'?kind=qa':newReference?'?kind=reference':''));await expect(page.locator('.bn-editor')).toBeVisible();
}
async function typeText(page:Page,text:string){const area=page.locator('.bn-editor[contenteditable="true"]');await area.click();await area.press('ControlOrMeta+End');await page.keyboard.insertText(text);}
const settingGroup:Record<string,string>={
 '阅读范围与资料':'内容与访问','选择文章分类':'内容与访问','自定义字段':'内容与访问',
 '封面与附件':'封面与附件','更新说明':'发布与管理','保存与管理':'发布与管理',
};
async function settings(page:Page,section='发布与管理'){
 await page.getByRole('button',{name:/^(文章设置|问答设置)$/}).click();
 const dialog=page.getByRole('dialog',{name:/^(文章设置|问答设置)$/});
 const group=settingGroup[section]??section;const toggle=dialog.getByRole('button',{name:new RegExp('^'+group)});
 if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
}
async function closeSettings(page:Page){await page.getByRole('button',{name:'关闭文章设置',exact:true}).click();}
async function insertBlockFromRail(page:Page,name:'提示框'|'代码块'|'表格'|'折叠内容'){
 await page.getByRole('navigation',{name:'编辑工具'}).getByRole('button',{name:'内容插入',exact:true}).click();
 await page.getByRole('region',{name:'内容插入'}).getByRole('button',{name:new RegExp(`^${name}`)}).click();
}
async function insertNativeSlashBlock(page:Page,name:'代码块'){
 await page.locator('.bn-editor').click();await page.keyboard.press('ControlOrMeta+End');await page.keyboard.press('Enter');await page.keyboard.type('/');await page.locator('.bn-suggestion-menu').getByText(name,{exact:true}).click();
}
test('release note autosaves, survives reload, and stays editable only before review',async({page})=>{
 let saved={...structuredClone(editorFixture),publishedRevision:1,publicationNumber:1};
 await page.route('**/api/admin/editor/*',route=>{const value=route.request().postDataJSON();saved={...saved,...value,sequence:saved.sequence+1};return route.fulfill({json:saved});});
 await mount(page,()=>saved);
 await settings(page,'更新说明');
 await page.getByRole('textbox',{name:'更新说明'}).fill('新增办理步骤\n修正所需资料');
 await expect.poll(()=>saved.releaseNote,{timeout:8000}).toBe('新增办理步骤\n修正所需资料');
 await expect(page.locator('.save-state')).toContainText('所有修改已保存',{timeout:8000});
 await page.reload();
 await settings(page,'更新说明');
 await expect(page.getByRole('textbox',{name:'更新说明'})).toHaveValue('新增办理步骤\n修正所需资料');
 saved={...saved,status:'in_review'};
 await page.reload();
 await settings(page,'更新说明');
 await expect(page.getByRole('textbox',{name:'更新说明'})).toBeDisabled();
});
test('English article editor uses English for its main actions and settings',async({page})=>{
 const categoryId='00000000-0000-4000-8000-000000000126';
 const english={...structuredClone(editorFixture),locale:'en' as const,translationOf:'11111111-1111-4111-8111-111111111111',title:'How to update your email',categoryIds:[categoryId],categoryOptions:[{id:categoryId,version:1,name:'账户安全',englishName:'Account security',parentId:null,position:0,audience:'staff' as const,enabled:true}]};
 await mount(page,()=>english);
 await expect(page.getByRole('button',{name:'Preview draft'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Article settings',exact:true})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Article title'})).toHaveValue('How to update your email');
 await expect(page.getByRole('button',{name:'Categories: Account security'})).toBeVisible();
 await page.getByRole('button',{name:'Article settings',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Article settings'}).getByRole('button',{name:/^Publishing and management/})).toBeVisible();
});
test('server-authorized Super Admin can directly publish the exact saved draft without a reason field',async({page})=>{
 const article={...structuredClone(editorFixture),canDirectPublish:true};const writes:unknown[]=[];
 await page.route('**/api/admin/review/*/publication',route=>{if(route.request().method()==='GET')return route.fulfill({json:{article,revision:1,approval:null,canQueue:false,canPublish:false,canDirectPublish:true,history:[],historyMore:false}});writes.push(route.request().postDataJSON());return route.fulfill({json:{documentId:article.documentId,sequence:4,revision:1,action:'direct_publish',status:'published',publishedRevision:1,approvedBy:'super-a'}});});
 await mount(page,()=>article);
 await page.getByRole('button',{name:'批准并发布',exact:true}).click();const dialog=page.getByRole('dialog',{name:'批准并发布'});await expect(dialog.locator('textarea,input[type="text"]')).toHaveCount(0);await dialog.getByRole('button',{name:'取消',exact:true}).click();expect(writes).toHaveLength(0);
 await page.getByRole('button',{name:'批准并发布',exact:true}).click();await page.getByRole('dialog',{name:'批准并发布'}).getByRole('button',{name:'确认发布',exact:true}).click();await expect(page.locator('.editor-notices').getByRole('status')).toContainText('已由你的 Super Admin 账号批准并发布');expect(writes).toEqual([{action:'direct_publish',expectedSequence:3}]);await expect(page.getByRole('alert')).toContainText('已经批准并发布');
});
test('English Super Admin editor requires natural-English confirmation before direct publication',async({page})=>{
 const article={...structuredClone(editorFixture),locale:'en' as const,title:'How to update your email',canDirectPublish:true};const writes:unknown[]=[];
 await page.route('**/api/admin/review/*/publication',route=>{if(route.request().method()==='GET')return route.fulfill({json:{article,revision:1,approval:null,canQueue:false,canPublish:false,canDirectPublish:true,history:[],historyMore:false}});writes.push(route.request().postDataJSON());return route.fulfill({json:{documentId:article.documentId,sequence:4,revision:1,action:'direct_publish',status:'published',publishedRevision:1,approvedBy:'super-a'}});});
 await mount(page,()=>article);await page.getByRole('button',{name:'Approve and publish',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Approve and publish'});const confirm=dialog.getByRole('button',{name:'Confirm publication',exact:true});await expect(confirm).toBeDisabled();await dialog.getByRole('checkbox').check();await confirm.click();await expect.poll(()=>writes).toEqual([{action:'direct_publish',expectedSequence:3,englishQualityConfirmed:true}]);
});
test('editor never exposes direct publication to an ordinary Admin',async({page})=>{await mount(page,()=>structuredClone(editorFixture));await expect(page.getByRole('button',{name:'批准并发布',exact:true})).toHaveCount(0);});
test('editor explains why direct publication is temporarily unavailable',async({page})=>{const article={...structuredClone(editorFixture),canDirectPublish:true};await mount(page,()=>article);const button=page.getByRole('button',{name:'批准并发布',exact:true});await expect(button).toBeEnabled();await page.getByRole('textbox',{name:'文章标题'}).fill('尚未保存的新标题');await expect(button).toBeDisabled();await expect(page.getByRole('status',{name:'发布暂不可用'})).toContainText(/未保存|正在保存/);});
test('editor identifies a failed draft save before direct publication',async({page})=>{const article={...structuredClone(editorFixture),canDirectPublish:true};await page.route('**/api/admin/editor/*',route=>route.fulfill({status:503,json:{error:'SAVE_FAILED'}}));await mount(page,()=>article);await page.getByRole('textbox',{name:'文章标题'}).fill('保存会失败的新标题');await expect(page.getByRole('status',{name:'发布暂不可用'})).toContainText('草稿保存失败',{timeout:8000});await expect(page.getByRole('button',{name:'批准并发布',exact:true})).toBeDisabled();});
test('editor separates workflow actions from a right-side authoring rail',async({page},testInfo)=>{
 const runtimeErrors:string[]=[];
 page.on('pageerror',error=>runtimeErrors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')runtimeErrors.push(message.text());});
 await mount(page,()=>structuredClone(editorFixture));
 const toolbar=page.locator('.editor-toolbar');
 await expect(toolbar.getByRole('button',{name:'预览草稿',exact:true})).toBeVisible();
 await expect(toolbar.getByRole('button',{name:'文章设置',exact:true})).toHaveCount(0);
 const rail=page.getByRole('navigation',{name:'编辑工具'});
 await expect(rail.getByRole('button',{name:'预览',exact:true})).toHaveCount(0);
 await expect(rail.getByRole('button',{name:'内容插入',exact:true})).toBeVisible();
 await expect(rail.getByRole('button',{name:'共用片段',exact:true})).toBeVisible();
 await expect(rail.getByRole('button',{name:'文章设置',exact:true})).toBeVisible();
 await rail.getByRole('button',{name:'内容插入',exact:true}).click();
 const panel=page.getByRole('region',{name:'内容插入'});
 await expect(panel).toBeVisible();
 await expect(panel.getByRole('button',{name:/^提示框/})).toBeVisible();
 await expect(panel.getByRole('button',{name:/^代码块/})).toBeVisible();
 await expect(panel.getByRole('button',{name:/^表格/})).toHaveCount(0);
 await expect(panel.getByRole('button',{name:/^分页标签/})).toBeVisible();
 await expect(panel.getByRole('button',{name:/^折叠内容/})).toBeVisible();
 await expect(panel.getByRole('button',{name:/^添加行内注释/})).toHaveCount(0);
 await expect(panel.getByRole('button',{name:/^插入行内元素/})).toHaveCount(0);
 await page.screenshot({path:`output/verification/editor-authoring-rail-${testInfo.project.name}.png`});
 await panel.getByRole('button',{name:/^提示框/}).click();
 await expect(page.locator('[data-juyu-type="hint"]')).toBeVisible();
 expect(runtimeErrors).toEqual([]);
});
test('compact workspace exposes one preview action and three complete settings groups',async({page},testInfo)=>{
 await mount(page,()=>null);
 const rail=page.getByRole('navigation',{name:'编辑工具'});
 await expect(rail.getByRole('button',{name:'预览',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'预览草稿',exact:true})).toHaveCount(1);
 await expect(page.locator('.editor-outline-guidance')).toHaveCount(0);
 await expect(page.locator('.editor-save-status').getByText(/草稿 · 自动保存/)).toBeVisible();
 await page.getByRole('button',{name:'文章设置',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'文章设置',exact:true});
 await expect(dialog.getByRole('button',{name:/^内容与访问/})).toBeVisible();
 await expect(dialog.getByRole('button',{name:/^封面与附件/})).toBeVisible();
 await expect(dialog.getByRole('button',{name:/^发布与管理/})).toBeVisible();
 await expect.poll(()=>dialog.locator('legend').first().evaluate(element=>element.getBoundingClientRect().height)).toBeGreaterThan(10);
 await expect.poll(()=>dialog.locator('label').filter({hasText:'资料类型'}).first().evaluate(element=>Number.parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(13);
 await expect(dialog.getByRole('button',{name:/^阅读范围与资料/})).toHaveCount(0);
 await expect(dialog.getByText('更新说明',{exact:true})).toHaveCount(0);
 await expect(dialog.getByText('自定义字段',{exact:true})).toHaveCount(0);
 await page.screenshot({path:`output/verification/editor-compact-settings-${testInfo.project.name}.png`,fullPage:false,animations:'disabled'});
 await dialog.getByRole('button',{name:/^封面与附件/}).click();
 await expect(dialog.getByText('填写标题并等候草稿保存后，即可上传文件。')).toBeVisible();
 await expect(dialog.getByLabel('上传文件',{exact:true})).toBeDisabled();
 await expect.poll(()=>dialog.locator('.editor-upload-control').evaluate(element=>getComputedStyle(element).opacity)).toBe('1');
 await dialog.getByRole('button',{name:/^发布与管理/}).click();
 await expect(dialog.getByRole('button',{name:'复制当前输入',exact:true})).toBeVisible();
 await expect(dialog.getByRole('button',{name:'重新载入',exact:true})).toBeVisible();
 await expect(dialog.getByRole('link',{name:'历史记录与版本',exact:true})).toHaveCount(0);
});

test('settings group minus control collapses the active group and can reopen it',async({page})=>{
 await mount(page,()=>null);
 await page.getByRole('button',{name:'文章设置',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'文章设置',exact:true});
 for(const name of ['内容与访问','封面与附件','发布与管理']){
  const toggle=dialog.getByRole('button',{name:new RegExp(`^${name}`)});
  if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded','true');
  await toggle.locator(':scope > span:last-child').click();
  await expect(toggle).toHaveAttribute('aria-expanded','false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded','true');
 }
 await dialog.getByRole('button',{name:/^发布与管理/}).locator(':scope > span:last-child').click();
 await expect(dialog.locator('.editor-settings-group-body:visible')).toHaveCount(0);
});

test('article settings keep form rows and category choices closely grouped',async({page},testInfo)=>{
 const categoryOptions=[
  {id:'00000000-0000-4000-8000-000000000201',version:1,name:'会员',parentId:null,position:0,audience:'staff' as const,enabled:true},
  {id:'00000000-0000-4000-8000-000000000202',version:1,name:'账户管理',parentId:null,position:1,audience:'staff' as const,enabled:true},
 ];
 await mount(page,()=>({...editorFixture,categoryOptions,categoryIds:[categoryOptions[0].id]}));
 await page.getByRole('button',{name:'文章设置',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'文章设置',exact:true});
 const layout=await dialog.evaluate(element=>{
  const firstFieldset=element.querySelector('.editor-settings-group-body > fieldset')!;
  const labels=[...element.querySelectorAll('.editor-metadata > label')];
  return {fieldsetMargin:getComputedStyle(firstFieldset).marginBlockStart,labelMargins:labels.map(label=>getComputedStyle(label).marginBlockStart)};
 });
 expect(layout.fieldsetMargin).toBe('0px');expect(layout.labelMargins).toEqual(['0px','0px']);
 const categories=dialog.getByRole('button',{name:/选择目录分类/});await expect(categories).toBeVisible();expect((await categories.boundingBox())!.height).toBeLessThanOrEqual(48);
 await categories.click();await expect(dialog.getByRole('option',{name:/会员/})).toHaveAttribute('aria-selected','true');await expect(dialog.getByRole('option',{name:/账户管理/})).toBeInViewport({ratio:1});
 const menu=dialog.getByRole('listbox',{name:'选择目录分类'});await expect(menu).toBeInViewport({ratio:1});
 await page.screenshot({path:`output/verification/editor-settings-compact-${testInfo.project.name}.png`,fullPage:true});
});

test('published article settings expose update note history and lifecycle actions',async({page})=>{
 const published={...structuredClone(editorFixture),status:'published' as const,publishedRevision:2,publicationNumber:1};
 await mount(page,()=>published);
 await settings(page,'更新说明');
 const dialog=page.getByRole('dialog',{name:'文章设置',exact:true});
 await expect(dialog.getByRole('textbox',{name:'更新说明',exact:true})).toBeVisible();
 await expect(dialog.getByRole('link',{name:'历史记录与版本',exact:true})).toBeVisible();
 await expect(dialog.getByRole('link',{name:'归档与下线',exact:true})).toBeVisible();
 await expect(dialog.getByRole('button',{name:'删除文章',exact:true})).toBeVisible();
});

test('content insert creates directly editable Fumadocs tabs with instant preview and persistence',async({page},testInfo)=>{
 let saved=structuredClone(editorFixture);
 await page.route('**/api/admin/editor/*',route=>{const value=route.request().postDataJSON();saved={...saved,...value,sequence:saved.sequence+1};return route.fulfill({json:saved});});
 await mount(page,()=>saved);
 await page.getByRole('navigation',{name:'编辑工具'}).getByRole('button',{name:'内容插入',exact:true}).click();
 const panel=page.getByRole('region',{name:'内容插入'});
 await expect(panel.getByRole('button',{name:/^分页标签/})).toBeVisible();
 await panel.getByRole('button',{name:/^分页标签/}).click();
 const block=page.locator('.editor-embedded[data-juyu-type="tabs"]');
 await expect(block).toBeVisible();
 await expect(block.getByText('编辑此内容块',{exact:true})).toHaveCount(0);
 await expect(block.getByLabel('标签 1 标题',{exact:true})).toBeVisible();
 await expect(block.getByLabel('标签 2 标题',{exact:true})).toBeVisible();
 await block.getByLabel('标签 1 标题',{exact:true}).fill('可以登录');
 await block.getByLabel('标签 1 内容',{exact:true}).fill('自行修改账号资料');
 await block.getByLabel('标签 2 标题',{exact:true}).fill('无法登录');
 await block.getByLabel('标签 2 内容',{exact:true}).fill('联系管理员处理');
 await block.getByRole('button',{name:'增加标签',exact:true}).click();
 await expect(block.getByLabel('标签 3 标题',{exact:true})).toHaveValue('标签 3');
 await block.getByRole('button',{name:'删除标签 3',exact:true}).click();
 await expect(block.getByLabel('标签 3 标题',{exact:true})).toHaveCount(0);
 await block.getByRole('region',{name:'编辑标签 2',exact:true}).getByRole('button',{name:'标签上移',exact:true}).click();
 await expect(block.getByLabel('标签 1 标题',{exact:true})).toHaveValue('无法登录');
 await block.getByRole('region',{name:'编辑标签 1',exact:true}).getByRole('button',{name:'标签下移',exact:true}).click();
 await expect(block.getByLabel('标签 1 标题',{exact:true})).toHaveValue('可以登录');
 const firstTab=block.getByRole('region',{name:'编辑标签 1',exact:true});
 await firstTab.getByRole('button',{name:'使用完整排版编辑',exact:true}).click();
 const nestedEditor=firstTab.locator('.rich-tab-body-editor .bn-editor');
 await expect(nestedEditor).toBeVisible();
 const nestedMetrics=await nestedEditor.evaluate(element=>({height:element.getBoundingClientRect().height,minHeight:getComputedStyle(element).minHeight,maxHeight:getComputedStyle(element).maxHeight}));
 expect(Number.parseFloat(nestedMetrics.minHeight)).toBeLessThanOrEqual(150);
 expect(Number.parseFloat(nestedMetrics.maxHeight)).toBeLessThanOrEqual(320);
 expect(nestedMetrics.height).toBeLessThanOrEqual(340);
 expect(await firstTab.getByLabel('标签 1 标题',{exact:true}).evaluate(element=>getComputedStyle(element).borderTopStyle)).toBe('solid');
 await block.scrollIntoViewIfNeeded();
 await page.screenshot({path:`output/verification/editor-tabs-${testInfo.project.name}.png`});
 await expect(firstTab.getByRole('button',{name:'完成排版编辑',exact:true})).toBeVisible();
 await firstTab.getByRole('button',{name:'完成排版编辑',exact:true}).click();
 await expect(nestedEditor).toHaveCount(0);
 await expect(firstTab.getByText('自行修改账号资料',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'预览草稿',exact:true}).click();
 const preview=page.locator('.editor-preview');
 await expect(preview.locator('[data-fumadocs-tabs]')).toBeVisible();
 await expect(preview.getByRole('tab',{name:'可以登录'})).toHaveAttribute('aria-selected','true');
 await preview.getByRole('tab',{name:'无法登录'}).click();
 await expect(preview.getByText('联系管理员处理',{exact:true})).toBeVisible();
 await expect.poll(()=>editorMedia(decodeEditorBody(saved.body)??[]).some(item=>item.type==='tabs'&&item.tabs.length===2&&item.tabs[1]?.title==='无法登录'&&item.tabs[1]?.body==='联系管理员处理'),{timeout:8000}).toBe(true);
 await page.reload();
 const restored=page.locator('.editor-embedded[data-juyu-type="tabs"]');
 await expect(restored.getByLabel('标签 1 标题',{exact:true})).toHaveValue('可以登录');
 await expect(restored.getByLabel('标签 2 标题',{exact:true})).toHaveValue('无法登录');
});
test('pasting a supported video URL into an empty paragraph creates a gated embed',async({page})=>{
 let saved={...structuredClone(editorFixture),body:encodeEditorBody([{id:'empty',type:'paragraph',props:{textAlignment:'left',textColor:'default',backgroundColor:'default'},content:[],children:[]}])};
 await page.route('**/api/admin/editor/*',route=>{saved={...saved,...route.request().postDataJSON(),sequence:saved.sequence+1};return route.fulfill({json:saved});});
 await mount(page,()=>saved);
 await page.locator('.bn-editor [data-content-type="paragraph"]').first().click();
 await page.evaluate(()=>{const target=document.activeElement;if(!target)throw Error('NO_EDITOR_FOCUS');const transfer=new DataTransfer();transfer.setData('text/plain','https://www.youtube.com/watch?v=dQw4w9WgXcQ');target.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:transfer}));});
 await expect(page.locator('[data-juyu-type="externalEmbed"]')).toBeVisible();
 await expect.poll(()=>decodeEditorBody(saved.body)?.some(block=>block.type==='juyu'&&JSON.parse(block.props.payload).url==='https://www.youtube.com/watch?v=dQw4w9WgXcQ'),{timeout:8000}).toBe(true);
 await expect(page.locator('.save-state')).toContainText('所有修改已保存',{timeout:8000});
});
test('pasting an unfamiliar HTTPS URL creates a safe link card instead of a blank embed',async({page})=>{
 let saved={...structuredClone(editorFixture),body:encodeEditorBody([{id:'empty',type:'paragraph',props:{textAlignment:'left',textColor:'default',backgroundColor:'default'},content:[],children:[]}])};
 await page.route('**/api/admin/editor/*',route=>{saved={...saved,...route.request().postDataJSON(),sequence:saved.sequence+1};return route.fulfill({json:saved});});
 await mount(page,()=>saved);
 await page.locator('.bn-editor [data-content-type="paragraph"]').first().click();
 await page.evaluate(()=>{const target=document.activeElement;if(!target)throw Error('NO_EDITOR_FOCUS');const transfer=new DataTransfer();transfer.setData('text/plain','https://example.com/guide');target.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:transfer}));});
 await expect(page.locator('[data-juyu-type="externalEmbed"]')).toBeVisible();
 await expect.poll(()=>decodeEditorBody(saved.body)?.some(block=>block.type==='juyu'&&JSON.parse(block.props.payload).url==='https://example.com/guide'),{timeout:8000}).toBe(true);
});
test('admin can save a selected text block as a private fragment and insert a reviewed copy',async({page})=>{
 let saved=structuredClone(editorFixture);
 const fragments:{id:string;familyId:string;version:number;title:string;blocks:unknown[];createdAt:string;sourceDocumentId:null}[]=[];
 await page.route('**/api/admin/fragments',route=>{
  if(route.request().method()==='GET')return route.fulfill({json:fragments});
  const input=route.request().postDataJSON();const fragment={...input,familyId:input.id,version:1,sourceDocumentId:null,createdAt:new Date().toISOString()};fragments.push(fragment);return route.fulfill({json:fragment});
 });
 await page.route('**/api/admin/editor/*',route=>{const value=route.request().postDataJSON();saved={...saved,...value,sequence:saved.sequence+1};return route.fulfill({json:saved});});
 await mount(page,()=>saved);
 await page.locator('.bn-editor').click();
 await page.getByRole('button',{name:'共用片段'}).click();
 const dialog=page.getByRole('dialog',{name:'可复用内容片段'});
 await expect(dialog).toBeVisible();
 await dialog.getByRole('textbox',{name:'片段名称'}).fill('标准开头');
 await dialog.getByRole('button',{name:'保存为片段'}).click();
 await expect(dialog.getByRole('status')).toContainText('已存入片段库');
 expect(fragments).toHaveLength(1);
 await dialog.getByRole('button',{name:'插入到文章'}).click();
 await expect(dialog).not.toBeVisible();
 await expect(page.locator('.save-state')).toContainText('所有修改已保存',{timeout:8000});
 const blocks=decodeEditorBody(saved.body);assertFragmentCopy(blocks,fragments[0].blocks);
});
test('updating a fragment keeps the article on its old version until the editor adopts the new draft',async({page})=>{
 let saved=structuredClone(editorFixture);
 const familyId='11111111-1111-4111-8111-111111111111';
 let latest={id:familyId,familyId,version:1,title:'账户核对',blocks:[{id:'source',type:'paragraph',props:{textAlignment:'left',textColor:'default',backgroundColor:'default'},content:[{type:'text',text:'请先核对账户',styles:{}}],children:[]}],createdAt:new Date().toISOString(),sourceDocumentId:null};
 await page.route('**/api/admin/fragments',route=>route.fulfill({json:[latest]}));
 await page.route('**/api/admin/fragments/*',route=>{const value=route.request().postDataJSON();expect(value.expectedVersion).toBe(1);latest={...latest,id:value.id,version:2,blocks:value.blocks};return route.fulfill({json:latest});});
 await page.route('**/api/admin/editor/*',route=>{const value=route.request().postDataJSON();saved={...saved,...value,sequence:saved.sequence+1};return route.fulfill({json:saved});});
 await mount(page,()=>saved);
 await page.locator('.bn-editor').click();await page.getByRole('button',{name:'共用片段'}).click();
 let dialog=page.getByRole('dialog',{name:'可复用内容片段'});await dialog.getByRole('combobox',{name:'选择片段'}).selectOption(familyId);
 await dialog.getByRole('button',{name:'插入到文章'}).click();await expect(page.locator('.save-state')).toContainText('所有修改已保存',{timeout:8000});
 let blocks=decodeEditorBody(saved.body)!;let wrapper=blocks.find(block=>block.type==='juyu'&&JSON.parse(block.props.payload).type==='reusableContent');expect(wrapper).toBeTruthy();if(!wrapper||wrapper.type!=='juyu')throw new Error('missing wrapper');expect(JSON.parse(wrapper.props.payload).version).toBe(1);
 await page.getByRole('button',{name:'共用片段'}).click();dialog=page.getByRole('dialog',{name:'可复用内容片段'});await dialog.getByRole('combobox',{name:'选择片段'}).selectOption(familyId);await dialog.getByRole('button',{name:'用当前选择建立新版本'}).click();await expect(dialog.getByRole('status')).toContainText('第 2 版');
 blocks=decodeEditorBody(saved.body)!;wrapper=blocks.find(block=>block.type==='juyu'&&JSON.parse(block.props.payload).type==='reusableContent');if(!wrapper||wrapper.type!=='juyu')throw new Error('missing old wrapper');expect(JSON.parse(wrapper.props.payload).version).toBe(1);
 await dialog.getByRole('button',{name:'在本篇采用最新版'}).click();await page.locator('dialog.juyu-confirm').getByRole('button',{name:'确认继续'}).click();await expect(dialog).not.toBeVisible();await expect(page.locator('.save-state')).toContainText('所有修改已保存',{timeout:8000});
 blocks=decodeEditorBody(saved.body)!;wrapper=blocks.find(block=>block.type==='juyu'&&JSON.parse(block.props.payload).type==='reusableContent');if(!wrapper||wrapper.type!=='juyu')throw new Error('missing new wrapper');expect(JSON.parse(wrapper.props.payload).version).toBe(2);
});
test('inserting a media fragment copies the private file into the target article before autosave',async({page})=>{
 let saved=structuredClone(editorFixture);const sourceId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',targetId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',familyId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 const fragment={id:familyId,familyId,version:1,title:'截图说明',blocks:[{id:'source-image',type:'image',props:{backgroundColor:'default',name:'proof.png',url:`/api/assets/${sourceId}`,caption:'原图'},children:[]}],createdAt:new Date().toISOString(),sourceDocumentId:null};
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9jjCcAAAAASUVORK5CYII=','base64');let uploads=0;
 await page.route('**/api/admin/fragments',route=>route.fulfill({json:[fragment]}));
 await page.route(`**/api/admin/assets/${sourceId}`,route=>route.fulfill({status:200,body:png,headers:{'Content-Type':'image/png','Content-Length':String(png.length)}}));
 await page.route('**/api/admin/media/*/upload',route=>{uploads++;return route.fulfill({json:{id:targetId,filename:'copy.png',mime:'image/png',size:String(png.length),status:'ready'}});});
 await page.route('**/api/admin/editor/*',route=>{const value=route.request().postDataJSON();saved={...saved,...value,sequence:saved.sequence+1};return route.fulfill({json:saved});});
 await mount(page,()=>saved);await page.locator('.bn-editor').click();await page.getByRole('button',{name:'共用片段'}).click();const dialog=page.getByRole('dialog',{name:'可复用内容片段'});await dialog.getByRole('combobox',{name:'选择片段'}).selectOption(familyId);await dialog.getByRole('button',{name:'插入到文章'}).click();
 await expect(dialog).not.toBeVisible({timeout:8000});await expect.poll(()=>decodeEditorBody(saved.body)?.some(block=>block.type==='juyu'&&JSON.parse(block.props.payload).type==='reusableContent'),{timeout:8000}).toBe(true);await expect(page.locator('.save-state')).toContainText('所有修改已保存',{timeout:8000});expect(uploads).toBe(1);const blocks=decodeEditorBody(saved.body)!;const wrapper=blocks.find(block=>block.type==='juyu'&&JSON.parse(block.props.payload).type==='reusableContent');expect(wrapper).toBeTruthy();expect(wrapper!.children[0].type).toBe('image');if(wrapper!.children[0].type==='image')expect(wrapper!.children[0].props.url).toBe(`/api/assets/${targetId}`);
});
test('unavailable source media leaves the target article untouched',async({page})=>{
 let saved=structuredClone(editorFixture),uploads=0;const sourceId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',familyId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 await page.route('**/api/admin/fragments',route=>route.fulfill({json:[{id:familyId,familyId,version:1,title:'失效截图',blocks:[{id:'missing-image',type:'image',props:{backgroundColor:'default',name:'lost.png',url:`/api/assets/${sourceId}`,caption:''},children:[]}],createdAt:new Date().toISOString(),sourceDocumentId:null}]}));
 await page.route(`**/api/admin/assets/${sourceId}`,route=>route.fulfill({status:404,json:{error:'NOT_FOUND'}}));
 await page.route('**/api/admin/media/*/upload',route=>{uploads++;return route.fulfill({status:500,json:{error:'UNEXPECTED'}});});
 await page.route('**/api/admin/editor/*',route=>{const value=route.request().postDataJSON();saved={...saved,...value,sequence:saved.sequence+1};return route.fulfill({json:saved});});
 await mount(page,()=>saved);await page.locator('.bn-editor').click();await page.getByRole('button',{name:'共用片段'}).click();const dialog=page.getByRole('dialog',{name:'可复用内容片段'});await dialog.getByRole('combobox',{name:'选择片段'}).selectOption(familyId);await dialog.getByRole('button',{name:'插入到文章'}).click();
 await expect(dialog.getByRole('status')).toContainText('片段未插入');expect(uploads).toBe(0);expect(decodeEditorBody(saved.body)).toBeNull();await expect(page.locator('.editor-embedded[data-juyu-type="reusableContent"]')).toHaveCount(0);
});
function assertFragmentCopy(blocks:ReturnType<typeof decodeEditorBody>,source:unknown[]){
 expect(blocks).not.toBeNull();expect(blocks!.length).toBeGreaterThan(1);
 const wrapper=blocks!.find(block=>block.type==='juyu'&&JSON.parse(block.props.payload).type==='reusableContent');expect(wrapper).toBeTruthy();expect(wrapper!.children[0].id).not.toBe((source[0] as {id:string}).id);
}
test('real BlockNote edits autosave reload and mixed blocks preview in order',async({page},info)=>{
 let saved=structuredClone(editorFixture);let writes=0;
 await page.route('**/api/admin/editor/*',async route=>{const value=route.request().postDataJSON();expect(value.expectedSequence).toBe(saved.sequence);saved={...saved,...value,sequence:saved.sequence+1};writes++;await route.fulfill({json:saved});});
 await mount(page,()=>saved);await typeText(page,' 中文更新');await expect(page.locator('.save-state')).toContainText('所有修改已保存',{timeout:8000});expect(writes).toBeGreaterThan(0);
 await insertBlockFromRail(page,'提示框');const hint=page.locator('.editor-embedded').last();const nested=hint.locator('xpath=ancestor::div[@data-node-type="blockContainer"][1]').locator('.bn-block-group .bn-inline-content').last();await nested.click();await page.keyboard.insertText('核对二审');await expect(page.locator('.save-state')).toContainText('所有修改已保存',{timeout:8000});
 await page.getByRole('button',{name:'预览草稿',exact:true}).click();await expect(page.locator('.editor-preview')).toContainText('中文更新');await expect(page.locator('.editor-preview')).toContainText('核对二审');
 await page.reload();await expect(page.locator('.bn-editor')).toContainText('中文更新');await expect(page.locator('.editor-embedded')).toHaveCount(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`output/verification/editor-${info.project.name}.png`,fullPage:true});await page.evaluate(()=>document.documentElement.classList.add('dark'));await page.locator('.editor-canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`output/verification/editor-dark-${info.project.name}.png`,fullPage:false});
});
test('open draft preview reflects typing before autosave reaches the server',async({page})=>{
 let saved=structuredClone(editorFixture);let writes=0;
 await page.route('**/api/admin/editor/*',async route=>{writes++;await new Promise(resolve=>setTimeout(resolve,1800));const value=route.request().postDataJSON();saved={...saved,...value,sequence:saved.sequence+1};await route.fulfill({json:saved});});
 await mount(page,()=>saved);
 await typeText(page,' Instant 1');
 await page.getByRole('button',{name:'预览草稿',exact:true}).click();
 const preview=page.locator('.editor-preview');
 await expect(preview).toContainText('Instant 1',{timeout:500});
 await expect(preview).toContainText('实时预览 · 尚未保存',{timeout:500});
 expect(writes).toBe(0);
});
test('draft preview uses the formal Fumadocs paragraph rhythm and ignores empty spacing blocks',async({page})=>{
 const props={textAlignment:'left' as const,textColor:'default' as const,backgroundColor:'default' as const};
 const text=(id:string,value:string)=>({id,type:'paragraph' as const,props,content:value?[{type:'text' as const,text:value,styles:{}}]:[],children:[]});
 const saved={...structuredClone(editorFixture),body:encodeEditorBody([text('preview-first','第一段'),text('preview-empty',''),text('preview-second','第二段')])};
 await mount(page,()=>saved);
 await page.getByRole('button',{name:'预览草稿',exact:true}).click();
 const reader=page.locator('.editor-preview [data-fumadocs-draft-reader]');
 await expect(reader).toBeVisible();
 const paragraphs=reader.locator('.gitbook-document.native-document>p');
 await expect(paragraphs).toHaveCount(2);
 await expect(reader.getByText('第一段',{exact:true})).toBeVisible();
 await expect(reader.getByText('第二段',{exact:true})).toBeVisible();
 await expect(paragraphs.first()).toHaveCSS('margin-bottom','20px');
 await expect(paragraphs.first()).toHaveCSS('line-height','28px');
});
test('BlockNote default text follows dark theme while authored emphasis colours remain',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('theme','dark'));
 const body=encodeEditorBody([{id:'theme-text',type:'paragraph',props:{textAlignment:'left',textColor:'rgb(0, 0, 0)',backgroundColor:'default'},content:[{type:'text',text:'普通黑字',styles:{textColor:'rgb(0, 0, 0)'}},{type:'text',text:'红色强调',styles:{textColor:'red'}}],children:[]}]);
 await mount(page,()=>({...structuredClone(editorFixture),body}));
 await expect(page.locator('html')).toHaveClass(/dark/);
 const root=page.locator('.editor-canvas .bn-container');await expect(root).toHaveAttribute('data-color-scheme','dark');
 const colors=await page.locator('.bn-editor').evaluate(editor=>{const walker=document.createTreeWalker(editor,NodeFilter.SHOW_TEXT);let node:Node|null;const result:{normal?:string;emphasis?:string;editor:string}={editor:getComputedStyle(editor).color};while(node=walker.nextNode()){if(node.textContent?.includes('普通黑字'))result.normal=getComputedStyle(node.parentElement!).color;if(node.textContent?.includes('红色强调'))result.emphasis=getComputedStyle(node.parentElement!).color;}return result;});
 expect(colors.normal).toBe(colors.editor);expect(colors.normal).not.toBe('rgb(0, 0, 0)');expect(colors.emphasis).not.toBe(colors.normal);
});
test('callout edits in place and uses a focused appearance inspector',async({page})=>{
 let saved=structuredClone(editorFixture);
 await page.route('**/api/admin/editor/*',route=>{const value=route.request().postDataJSON();saved={...saved,...value,sequence:saved.sequence+1};return route.fulfill({json:saved});});
 await mount(page,()=>saved);
 await insertBlockFromRail(page,'提示框');
 const hint=page.locator('.editor-embedded').last();
 await expect(hint.getByText('编辑此内容块',{exact:true})).toHaveCount(0);
 await expect(hint.getByRole('button',{name:'在提示框中新增内容'})).toHaveCount(0);
 await expect(page.getByRole('region',{name:'提示框设置'})).toHaveCount(0);
 const nested=hint.locator('xpath=ancestor::div[@data-node-type="blockContainer"][1]').locator('.bn-block-group .bn-inline-content').last();
 const nestedOuter=hint.locator('xpath=ancestor::div[@data-node-type="blockContainer"][1]').locator(':scope > .bn-block-group > .bn-block-outer').first();
 await expect.poll(()=>nestedOuter.evaluate(element=>getComputedStyle(element,'::before').content)).toBe('none');
 await page.keyboard.insertText('先核实员工身份');
 await expect(nested).toContainText('先核实员工身份');
 await hint.click();
 await hint.getByRole('textbox',{name:'提示标题'}).fill('执行前核对');
 const hintLayout=await hint.evaluate(element=>{const layout=element.querySelector('.editor-hint-layout')!,icon=element.querySelector('.editor-hint-icon')!.getBoundingClientRect(),title=element.querySelector('.editor-hint-heading')!.getBoundingClientRect();return {display:getComputedStyle(layout).display,iconRight:icon.right,titleLeft:title.left};});
 expect(hintLayout.display).toBe('grid');expect(hintLayout.titleLeft).toBeGreaterThanOrEqual(hintLayout.iconRight);
 const inspector=page.getByRole('region',{name:'提示框设置'});
 await expect(inspector).toBeVisible();
 await inspector.getByRole('button',{name:'注意'}).click();
 await inspector.getByRole('combobox',{name:'提示图标'}).selectOption('shield');
 await expect(inspector.getByRole('checkbox',{name:'显示标题'})).toBeChecked();
 await page.screenshot({path:`output/verification/rich-hint-inspector-${test.info().project.name}.png`,fullPage:false});
 await inspector.getByRole('button',{name:'关闭提示框设置'}).click();
 await expect.poll(()=>saved.body.startsWith('JUYU_BLOCKNOTE_V1\n')&&JSON.parse(saved.body.split('\n').slice(1).join('\n')).some((block:{type:string;children:{content:{text:string}[]}[]})=>block.type==='juyu'&&block.children.some(child=>child.content.some(text=>text.text==='先核实员工身份'))),{timeout:8000}).toBe(true);
 const payload=JSON.parse(JSON.parse(saved.body.split('\n').slice(1).join('\n')).find((block:{type:string})=>block.type==='juyu').props.payload);
 expect(payload).toMatchObject({style:'warning',title:'执行前核对',iconKey:'shield',showTitle:true});
 await page.getByRole('button',{name:'预览草稿',exact:true}).click();
 await expect(page.locator('.editor-preview [data-fumadocs-callout]')).toContainText('执行前核对');
 await expect(page.locator('.editor-preview [data-fumadocs-callout]')).toContainText('先核实员工身份');
 await page.screenshot({path:`output/verification/rich-hint-nested-${test.info().project.name}.png`,fullPage:true});
});
test('advanced code block edits directly and uses only the global Fumadocs preview',async({page},testInfo)=>{
 await mount(page,()=>structuredClone(editorFixture));
 await insertBlockFromRail(page,'代码块');
 const block=page.locator('.editor-embedded[data-juyu-type="code"]');
 await expect(block).toBeVisible();
 await expect(block.getByText('编辑此内容块',{exact:true})).toHaveCount(0);
 await expect(block.getByText('查看此块预览',{exact:true})).toHaveCount(0);
 const code=block.getByLabel('代码内容',{exact:true});
 await expect(code).toBeVisible();
 await expect(code).toBeFocused();
 const language=block.getByLabel('代码语言',{exact:true});
 const title=block.getByLabel('文件名或标题（可选）',{exact:true});
 const [languageBox,titleBox,codeStyle]=await Promise.all([language.boundingBox(),title.boundingBox(),code.evaluate(element=>({background:getComputedStyle(element).backgroundColor,border:getComputedStyle(element).borderStyle}))]);
 if(testInfo.project.name==='mobile')expect(titleBox!.y).toBeGreaterThan(languageBox!.y);else expect(languageBox?.y).toBe(titleBox?.y);
 expect(codeStyle).toEqual({background:'rgb(17, 24, 39)',border:'solid'});
 await language.fill('javascript');
 await title.fill('config.js');
 await code.fill('console.log("hello");');
 await page.getByRole('button',{name:'预览草稿',exact:true}).click();
 const preview=page.locator('.editor-preview [data-fumadocs-code]');
 await expect(preview).toBeVisible();
 await expect(preview).toContainText('config.js');
 await expect(preview).toContainText('console.log');
 await page.screenshot({path:`output/verification/rich-code-direct-${testInfo.project.name}.png`,fullPage:true});
});
test('an empty callout stays out of draft preview',async({page})=>{
 await mount(page,()=>structuredClone(editorFixture));
 await insertBlockFromRail(page,'提示框');
 await page.getByRole('button',{name:'预览草稿',exact:true}).click();
 await expect(page.locator('.editor-preview [data-fumadocs-callout]')).toHaveCount(0);
});
test('accordion inserts as a direct editor and hides empty output until content exists',async({page})=>{
 await mount(page,()=>structuredClone(editorFixture));
 await insertBlockFromRail(page,'折叠内容');
 const block=page.locator('.editor-embedded[data-juyu-type="accordion"]');
 await expect(block).toBeVisible();
 await expect(block.getByText('编辑此内容块',{exact:true})).toHaveCount(0);
 await expect(block.getByText('查看此块预览',{exact:true})).toHaveCount(0);
 const title=block.getByLabel('折叠项 1 标题',{exact:true});
 const body=block.getByLabel('折叠项 1 内容',{exact:true});
 await expect(title).toBeVisible();
 await expect(body).toBeVisible();
 await expect(title).toHaveValue('');
 await expect(title).toBeFocused();
 await page.getByRole('button',{name:'预览草稿',exact:true}).click();
 const preview=page.locator('.editor-preview');
 await expect(preview.locator('[data-fumadocs-accordion]')).toHaveCount(0);
 await page.getByRole('button',{name:'关闭草稿预览',exact:true}).click();
 await title.fill('如何修改账号？');
 await body.fill('进入账号设置后修改。');
 await page.getByRole('button',{name:'预览草稿',exact:true}).click();
 const trigger=preview.getByRole('button',{name:'如何修改账号？',exact:true});
 await expect(trigger).toBeVisible();
 await trigger.click();
 await expect(preview.getByText('进入账号设置后修改。',{exact:true})).toBeVisible();
});
test('typing during an outstanding save is retained and saved with the acknowledged sequence',async({page})=>{
 let release!:()=>void;const pending=new Promise<void>(r=>release=r);const calls:Record<string,unknown>[]=[];let saved=structuredClone(editorFixture);
 await page.route('**/api/admin/editor/*',async route=>{const v=route.request().postDataJSON();calls.push(v);if(calls.length===1)await pending;saved={...saved,...v,sequence:saved.sequence+1};await route.fulfill({json:saved});});
 await mount(page,()=>saved);await page.getByRole('textbox',{name:/^(文章标题|问题)$/}).fill('第一段修改');await expect.poll(()=>calls.length,{timeout:6000}).toBe(1);
 await page.getByRole('textbox',{name:/^(文章标题|问题)$/}).fill('发送期间继续修改');release();await expect(page.getByRole('textbox',{name:/^(文章标题|问题)$/})).toHaveValue('发送期间继续修改');await expect.poll(()=>calls.length,{timeout:8000}).toBe(2);await expect(page.locator('.save-state')).toContainText('所有修改已保存');expect(calls[1].expectedSequence).toBe(4);expect(saved.title).toBe('发送期间继续修改');
});
test('failed save retains content pauses retries and warns before leaving',async({page})=>{
 let fail=true,writes=0;let saved=structuredClone(editorFixture);
 await page.route('**/api/admin/editor/*',async route=>{writes++;if(fail)return route.fulfill({status:503,json:{error:'EDITOR_UNAVAILABLE'}});saved={...saved,...route.request().postDataJSON(),sequence:saved.sequence+1};await route.fulfill({json:saved});});
 await mount(page,()=>saved);await typeText(page,' 保留输入');await expect(page.getByRole('status')).toContainText('保存尚未确认',{timeout:6000});expect(writes).toBe(1);
 await page.getByRole('link',{name:'离开编辑页'}).click();await page.getByRole('dialog').getByRole('button',{name:'取消',exact:true}).click();await expect(page.locator('.bn-editor')).toContainText('保留输入');
 fail=false;await page.getByRole('button',{name:'重试保存'}).click();await expect(page.locator('.save-state')).toContainText('所有修改已保存');expect(writes).toBe(2);
});
test('new document uses stable id and frozen review document cannot be edited',async({page})=>{
 let saved:EditorData|null=null;let requested='';
 await page.route('**/api/admin/editor/*',async route=>{requested=new URL(route.request().url()).pathname.split('/').pop()!;const v=route.request().postDataJSON();expect(v.expectedSequence).toBe(null);saved={...editorFixture,...v,documentId:requested,sequence:0};await route.fulfill({json:saved});});
 await mount(page,()=>saved);await page.getByRole('textbox',{name:/^(文章标题|问题)$/}).fill('新建内部资料');await expect(page.locator('.save-state')).toContainText('所有修改已保存',{timeout:8000});expect(requested).toMatch(/^[a-f0-9-]{36}$/);await expect(page).toHaveURL(new RegExp(`article=${requested}`));
 saved={...saved!,status:'in_review'};await page.reload();await expect(page.getByRole('textbox',{name:/^(文章标题|问题)$/})).toBeDisabled();await expect(page.locator('.bn-editor')).toHaveAttribute('contenteditable','false');await settings(page);await expect(page.getByRole('button',{name:'立即保存',exact:true})).toBeDisabled();await closeSettings(page);
});
test('conflict does not overwrite typed input and plain URL text does not embed remote media',async({page})=>{
 await page.route('**/api/admin/editor/*',route=>route.fulfill({status:409,json:{error:'CONFLICT'}}));await mount(page,()=>editorFixture);await typeText(page,' https://company.test/image.png ');await expect(page.getByRole('status')).toContainText('不会覆盖服务器版本',{timeout:8000});await expect(page.locator('.bn-editor')).toContainText('https://company.test/image.png');await expect(page.locator('.bn-editor img')).toHaveCount(0);await expect(page.locator('.bn-editor a[href="https://company.test/image.png"]')).toHaveCount(1);
});
test('real editor pages and GET PUT reject unconfigured forged identity',async({request,page})=>{
 for(const method of ['get','put'] as const){const r=await request[method]('/api/admin/editor/00000000-0000-4000-8000-000000000031',{headers:{'x-role':'admin','x-user-id':'admin'},...(method==='put'?{data:{expectedSequence:null,title:'forged'}}:{})});expect(r.status()).toBe(503);expect(r.headers()['cache-control']).toBe('private, no-store');}
 await page.goto('/admin/editor');await expect(page.locator('.bn-editor')).toHaveCount(0);
});
test('native code block edits directly and keeps its text through save and reload',async({page})=>{
 let saved=structuredClone(editorFixture);
 await page.route('**/api/admin/editor/*',async route=>{saved={...saved,...route.request().postDataJSON(),sequence:saved.sequence+1};await route.fulfill({json:saved});});
 await mount(page,()=>saved);await insertNativeSlashBlock(page,'代码块');await page.locator('[data-content-type="codeBlock"] select').selectOption('python');await page.locator('[data-content-type="codeBlock"] pre').click();await page.keyboard.insertText('print("保留代码")');await expect(page.locator('[data-content-type="codeBlock"] code [style*="--shiki"]')).not.toHaveCount(0);await expect(page.locator('.save-state')).toContainText('所有修改已保存',{timeout:8000});await page.reload();await expect(page.locator('[data-content-type="codeBlock"] code')).toHaveText('print("保留代码")');
});
test('recovery compares server content preserves local input and adopts the server sequence explicitly',async({page},info)=>{
 let server={...editorFixture,title:'服务器最新标题',body:'另一位管理员的正文',sequence:4};let writes=0;
 await page.route('**/api/admin/editor/*',async route=>{if(route.request().method()==='GET')return route.fulfill({json:server});writes++;const v=route.request().postDataJSON();if(v.expectedSequence!==server.sequence)return route.fulfill({status:409,json:{error:'CONFLICT'}});server={...server,...v,sequence:server.sequence+1};await route.fulfill({json:server});});
 await mount(page,()=>editorFixture);await typeText(page,' 我的未保存文字');await expect(page.locator('.save-state')).toContainText('不会覆盖服务器版本');
 await expect(page.getByRole('button',{name:'重试保存',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'查看最新版本并对照',exact:true}).first().click();await expect(page.getByRole('region',{name:'服务器版本'})).toContainText('另一位管理员的正文');await expect(page.locator('.bn-editor')).toContainText('我的未保存文字');expect(writes).toBe(1);
 await page.getByRole('region',{name:'保存恢复'}).scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`output/verification/recovery-${info.project.name}.png`,fullPage:false});
 await page.getByRole('button',{name:'保留备份并载入此版本'}).click();await page.getByRole('dialog').getByRole('button',{name:'取消',exact:true}).click();await expect(page.locator('.bn-editor')).toContainText('我的未保存文字');
 await page.getByRole('button',{name:'保留备份并载入此版本'}).click();await page.getByRole('dialog').getByRole('button',{name:'确认继续',exact:true}).click();await expect(page.getByRole('textbox',{name:/^(文章标题|问题)$/})).toHaveValue('服务器最新标题');await expect(page.locator('.bn-editor')).toContainText('另一位管理员的正文');
 await page.getByText('载入前的输入备份 1',{exact:true}).click();await expect(page.getByLabel('载入前的输入备份 1',{exact:true})).toContainText('我的未保存文字');expect(writes).toBe(1);
 await page.getByRole('textbox',{name:/^(文章标题|问题)$/}).fill('合并整理后标题');await expect.poll(()=>server.sequence,{timeout:8000}).toBe(5);await expect(page.locator('.save-state')).toContainText('所有修改已保存');expect(writes).toBe(2);
 await page.getByRole('link',{name:'离开编辑页'}).click();await page.getByRole('dialog').getByRole('button',{name:'取消',exact:true}).click();await expect(page.getByLabel('载入前的输入备份 1',{exact:true})).toBeVisible();
});
test('recovery read failure wrong article and clipboard failure retain input without allowing adoption',async({page})=>{
 let reply='failure';await page.route('**/api/admin/editor/*',route=>route.request().method()==='PUT'?route.fulfill({status:409,json:{error:'CONFLICT'}}):reply==='failure'?route.fulfill({status:403,json:{error:'FORBIDDEN'}}):route.fulfill({json:{...editorFixture,documentId:'wrong',sequence:4}}));
 await mount(page,()=>editorFixture);await typeText(page,' 不可丢失');await expect(page.getByRole('region',{name:'保存恢复'})).toBeVisible();await page.getByRole('button',{name:'读取服务器最新版本'}).click();await expect(page.getByRole('region',{name:'保存恢复'}).getByRole('alert')).toContainText('没有管理权限');await expect(page.getByRole('region',{name:'服务器版本'})).toHaveCount(0);
 reply='wrong';await page.getByRole('button',{name:'读取服务器最新版本'}).click();await expect(page.getByRole('region',{name:'保存恢复'}).getByRole('alert')).toContainText('未读取成功');await expect(page.getByRole('button',{name:'保留备份并载入此版本'})).toHaveCount(0);
 await page.getByText('当前输入备份',{exact:true}).click();await page.evaluate(()=>{Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:()=>Promise.reject(new Error('denied'))});document.execCommand=()=>false;});await page.getByRole('button',{name:'复制这份备份'}).click();await expect(page.getByText('复制未成功，请选中上方文字手动复制。')).toBeVisible();await expect(page.getByLabel('当前输入备份',{exact:true})).toContainText('不可丢失');
});
test('recovery of a submitted snapshot locks editing and preserves previous input',async({page})=>{
 const latest={...editorFixture,sequence:4,status:'in_review'};await page.route('**/api/admin/editor/*',r=>r.request().method()==='GET'?r.fulfill({json:latest}):r.fulfill({status:409,json:{error:'INVALID_STATE'}}));
 await mount(page,()=>editorFixture);await typeText(page,' 审核前输入');await expect(page.getByRole('region',{name:'保存恢复'})).toBeVisible();await page.getByRole('button',{name:'读取服务器最新版本'}).click();await expect(page.getByRole('region',{name:'服务器版本'})).toContainText('等待审核');await page.getByRole('button',{name:'保留备份并载入此版本'}).click();await page.getByRole('dialog').getByRole('button',{name:'确认继续',exact:true}).click();await expect(page.locator('.bn-editor')).toHaveAttribute('contenteditable','false');await settings(page);await expect(page.getByRole('button',{name:'立即保存',exact:true})).toBeDisabled();await closeSettings(page);await page.getByText('载入前的输入备份 1',{exact:true}).click();await expect(page.getByLabel('载入前的输入备份 1',{exact:true})).toContainText('审核前输入');
});
test('server changing after comparison still conflicts and a second recovery retains both inputs',async({page})=>{
 let server={...editorFixture,sequence:4,title:'第一次服务器标题'};const sequences:number[]=[];
 await page.route('**/api/admin/editor/*',route=>{if(route.request().method()==='GET')return route.fulfill({json:server});sequences.push(route.request().postDataJSON().expectedSequence);return route.fulfill({status:409,json:{error:'CONFLICT'}});});
 await mount(page,()=>editorFixture);await page.getByRole('textbox',{name:/^(文章标题|问题)$/}).fill('第一份本地输入');await expect(page.getByRole('region',{name:'保存恢复'})).toBeVisible();await page.getByRole('button',{name:'读取服务器最新版本'}).click();await expect(page.getByRole('region',{name:'服务器版本'})).toContainText('服务器版本 4');
 server={...server,sequence:5,title:'又被更新的服务器标题'};await page.getByRole('button',{name:'保留备份并载入此版本'}).click();await page.getByRole('dialog').getByRole('button',{name:'确认继续',exact:true}).click();await page.getByRole('textbox',{name:/^(文章标题|问题)$/}).fill('第二份本地输入');await expect(page.getByRole('region',{name:'保存恢复'})).toBeVisible();expect(sequences).toEqual([3,4]);
 await page.getByRole('button',{name:'读取服务器最新版本'}).click();await expect(page.getByRole('region',{name:'服务器版本'})).toContainText('服务器版本 5');await page.getByRole('button',{name:'保留备份并载入此版本'}).click();await page.getByRole('dialog').getByRole('button',{name:'确认继续',exact:true}).click();await page.getByText('载入前的输入备份 1',{exact:true}).click();await page.getByText('载入前的输入备份 2',{exact:true}).click();await expect(page.getByLabel('载入前的输入备份 1',{exact:true})).toContainText('第一份本地输入');await expect(page.getByLabel('载入前的输入备份 2',{exact:true})).toContainText('第二份本地输入');await expect(page.getByRole('textbox',{name:/^(文章标题|问题)$/})).toHaveValue('又被更新的服务器标题');
});
test('editor trash action requires saved input and typed confirmation then freezes after acknowledgement',async({page})=>{
 let saved=structuredClone(editorFixture),writes=0;
 await page.route('**/api/admin/editor/*',r=>{saved={...saved,...r.request().postDataJSON(),sequence:saved.sequence+1};return r.fulfill({json:saved});});
 await page.route('**/api/admin/lifecycle/*',r=>{expect(r.request().postDataJSON()).toEqual({action:'trash',expectedSequence:saved.sequence});writes++;return r.fulfill({json:{documentId:saved.documentId,action:'trash',sequence:saved.sequence+1,cleanupPending:0}});});
 await mount(page,()=>saved);await typeText(page,' 修改后删除');await settings(page);await expect(page.getByRole('button',{name:'删除文章',exact:true})).toBeDisabled();await expect.poll(()=>saved.sequence).toBe(4);
 await page.getByRole('button',{name:'删除文章',exact:true}).click();const modal=page.getByRole('dialog',{name:'将文章移入回收站？'});
 await expect(modal.getByRole('button',{name:'移入回收站',exact:true})).toBeDisabled();await modal.getByRole('textbox').fill('错误标题');await expect(modal.getByRole('button',{name:'移入回收站',exact:true})).toBeDisabled();expect(writes).toBe(0);
 await modal.getByRole('button',{name:'取消',exact:true}).click();await page.getByRole('button',{name:'删除文章',exact:true}).click();await expect(modal.getByRole('textbox')).toHaveValue('');await modal.getByRole('textbox').fill(saved.title);await modal.getByRole('button',{name:'移入回收站',exact:true}).click();
 await expect(page.getByRole('region',{name:'文章删除'})).toContainText('已移入回收站');await closeSettings(page);await expect(page.locator('.bn-editor')).toHaveAttribute('contenteditable','false');expect(writes).toBe(1);
});
test('upload-in-progress rejection keeps editor data available',async({page})=>{
 await page.route('**/api/admin/lifecycle/*',r=>r.fulfill({status:409,json:{error:'UPLOAD_IN_PROGRESS'}}));await mount(page,()=>editorFixture);await settings(page);await page.getByRole('button',{name:'删除文章',exact:true}).click();const modal=page.getByRole('dialog',{name:'将文章移入回收站？'});await modal.getByRole('textbox').fill(editorFixture.title);await modal.getByRole('button',{name:'移入回收站',exact:true}).click();await expect(modal.getByRole('alert')).toContainText('仍在上传');await modal.getByRole('button',{name:'取消',exact:true}).click();await closeSettings(page);await expect(page.locator('.bn-editor')).toHaveAttribute('contenteditable','true');await expect(page.getByRole('textbox',{name:'文章标题',exact:true})).toHaveValue(editorFixture.title);
});

test('editing a published article saves a new draft while showing that its old formal version remains readable',async({page})=>{
 let saved:EditorData={...structuredClone(editorFixture),status:'published',publicationNumber:1,publishedRevision:2};
 await page.route('**/api/admin/editor/*',r=>{const value=r.request().postDataJSON();expect(value.expectedSequence).toBe(3);saved={...saved,...value,sequence:4,status:'draft',publishedRevision:2};return r.fulfill({json:saved});});
 await mount(page,()=>saved);await expect(page.getByText('修改会保存为新草稿，旧正式版继续可读；新稿需要重新二审和发布。',{exact:true})).toBeVisible();
 await page.getByRole('textbox',{name:/^(文章标题|问题)$/}).fill('修改后的正式资料');await expect(page.locator('.save-state')).toContainText('所有修改已保存',{timeout:8000});await expect(page.getByText('旧正式版 1 仍可阅读',{exact:true})).toBeVisible();await settings(page);expect(saved.status).toBe('draft');expect(saved.publishedRevision).toBe(2);await expect(page.getByRole('link',{name:'归档与下线'})).toHaveAttribute('href','/admin/availability?article=editor-local');
});
test('new OPS documents default to restricted audience and cannot select ordinary staff',async({page})=>{
 let saved:EditorData|null=null;
 await page.route('**/api/admin/editor/*',async route=>{const v=route.request().postDataJSON();expect(v.kind).toBe('ops');expect(v.audience).toBe('ops');saved={...editorFixture,...v,documentId:new URL(route.request().url()).pathname.split('/').pop()!,sequence:0};await route.fulfill({json:saved});});
 await mount(page,()=>null);await settings(page,'阅读范围与资料');await page.getByRole('combobox',{name:'资料类型',exact:true}).selectOption('ops');await expect(page.getByRole('combobox',{name:'阅读范围',exact:true})).toHaveValue('ops');await expect(page.getByRole('combobox',{name:'阅读范围',exact:true}).locator('option[value="staff"]')).toHaveCount(0);
 await closeSettings(page);await page.getByRole('textbox',{name:/^(文章标题|问题)$/}).fill('运营资料测试样例');await expect(page.locator('.save-state')).toContainText('所有修改已保存',{timeout:8000});await settings(page,'阅读范围与资料');await expect(page.getByRole('combobox',{name:'资料类型',exact:true})).toBeDisabled();expect(saved).not.toBeNull();
});

test('Reference shortcut presets a new document but does not change the kind of an existing article',async({page})=>{
 let saved:EditorData|null=null;await page.route('**/api/admin/editor/*',async route=>{const v=route.request().postDataJSON();expect(v.kind).toBe('reference');saved={...editorFixture,...v,documentId:new URL(route.request().url()).pathname.split('/').pop()!,sequence:0};await route.fulfill({json:saved});});
 await mount(page,()=>null,true);await settings(page,'阅读范围与资料');await expect(page.getByRole('combobox',{name:'资料类型',exact:true})).toHaveValue('reference');await closeSettings(page);await page.getByRole('textbox',{name:/^(文章标题|问题)$/}).fill('速查表测试样例');await expect(page.locator('.save-state')).toContainText('所有修改已保存',{timeout:8000});expect(saved).not.toBeNull();
 await page.unrouteAll();await mount(page,()=>editorFixture,true);await settings(page,'阅读范围与资料');await expect(page.getByRole('combobox',{name:'资料类型',exact:true})).toHaveValue(editorFixture.kind);await expect(page.getByRole('combobox',{name:'资料类型',exact:true})).toBeDisabled();
});


test('Q&A shortcut saves classification and order as draft metadata and preserves them on reload',async({page},info)=>{
 let saved:EditorData|null=null;
 await page.route('**/api/admin/editor/*',async r=>{const v=r.request().postDataJSON();saved={...editorFixture,...v,documentId:new URL(r.request().url()).pathname.split('/').pop()!,sequence:saved?saved.sequence+1:0};return r.fulfill({json:saved});});
 await mount(page,()=>saved,'qa');await settings(page,'阅读范围与资料');await expect(page.getByRole('combobox',{name:'资料类型',exact:true})).toHaveValue('qa');
 await expect(page.getByRole('dialog',{name:/^(文章设置|问答设置)$/}).getByRole('textbox',{name:'问答分类',exact:true})).toHaveAttribute('maxlength','80');await page.getByRole('dialog',{name:/^(文章设置|问答设置)$/}).getByRole('textbox',{name:'问答分类',exact:true}).fill('账户问题');await page.getByRole('textbox',{name:'相关话题（最多 5 个）',exact:true}).fill('信用额度，签约店铺');await page.getByLabel('问答排序',{exact:true}).fill('12');await closeSettings(page);await page.getByRole('textbox',{name:/^(文章标题|问题)$/}).fill('如何核对账户？');
 await expect(page.locator('.save-state')).toContainText('所有修改已保存',{timeout:8000});expect(saved).toMatchObject({kind:'qa',tags:['信用额度','签约店铺'],qa:{category:'账户问题',position:12}});
 await page.reload();await settings(page,'阅读范围与资料');await expect(page.getByRole('dialog',{name:/^(文章设置|问答设置)$/}).getByRole('textbox',{name:'问答分类',exact:true})).toHaveValue('账户问题');await expect(page.getByLabel('问答排序',{exact:true})).toHaveValue('12');
 await page.getByLabel('问答排序',{exact:true}).fill('-1');await closeSettings(page);await expect(page.getByRole('alert')).toContainText('问答排序须为');await settings(page);await expect(page.getByRole('button',{name:'立即保存',exact:true})).toBeDisabled();await closeSettings(page);await settings(page,'阅读范围与资料');
 await page.getByLabel('问答排序',{exact:true}).fill('5');await closeSettings(page);await expect(page.locator('.save-state')).toContainText('所有修改已保存',{timeout:8000});expect(saved).toMatchObject({qa:{category:'账户问题',position:5}});
 await page.screenshot({path:`output/verification/qa-editor-${info.project.name}.png`,fullPage:true});
});
test('Q&A metadata row uses an aligned category summary that opens the category settings',async({page})=>{
 await mount(page,()=>({...editorFixture,kind:'qa',qa:{category:'账户问题',position:4}}),'qa');
 const summary=page.getByRole('button',{name:'问答分类：账户问题',exact:true});
 await expect(summary).toBeVisible();
 await expect(page.locator('.editor-metadata-summary').getByRole('textbox',{name:'问答分类',exact:true})).toHaveCount(0);
 const controls=page.locator('.editor-metadata-summary > button');
 await expect(controls).toHaveCount(3);
 expect(new Set(await controls.evaluateAll(items=>items.map(item=>item.getBoundingClientRect().height))).size).toBe(1);
 await summary.click();
 const dialog=page.getByRole('dialog',{name:/^(文章设置|问答设置)$/});
 await expect(dialog).toBeVisible();
 await expect(dialog.getByRole('textbox',{name:'问答分类',exact:true})).toHaveValue('账户问题');
});
test('Q&A classification freezes in review and the shortcut never changes an existing kind',async({page})=>{
 await mount(page,()=>({...editorFixture,kind:'qa',qa:{category:'既有分类',position:4},status:'in_review'}),'qa');await expect(page.getByRole('button',{name:'问答分类：既有分类',exact:true})).toBeVisible();await settings(page,'阅读范围与资料');await expect(page.getByRole('dialog',{name:/^(文章设置|问答设置)$/}).getByRole('textbox',{name:'问答分类',exact:true})).toBeDisabled();await expect(page.getByLabel('问答排序',{exact:true})).toBeDisabled();await closeSettings(page);
 await page.unrouteAll();await mount(page,()=>editorFixture,'qa');await settings(page,'阅读范围与资料');await expect(page.getByRole('combobox',{name:'资料类型',exact:true})).toHaveValue('article');await expect(page.getByRole('textbox',{name:'问答分类',exact:true})).toHaveCount(0);
});

test('Q&A recovery keeps classification input and displays the server version before explicit replacement',async({page})=>{
 const initial:EditorData={...editorFixture,kind:'qa',qa:{category:'原分类',position:1}};const latest:EditorData={...initial,sequence:4,qa:{category:'服务器分类',position:6}};
 await page.route('**/api/admin/editor/*',r=>r.request().method()==='GET'?r.fulfill({json:latest}):r.fulfill({status:409,json:{error:'CONFLICT'}}));await mount(page,()=>initial);
 await page.getByRole('button',{name:'问答分类：原分类',exact:true}).click();await page.getByRole('dialog',{name:/^(文章设置|问答设置)$/}).getByRole('textbox',{name:'问答分类',exact:true}).fill('本地分类');await closeSettings(page);await expect(page.getByRole('region',{name:'保存恢复'})).toBeVisible();await page.getByRole('button',{name:'读取服务器最新版本'}).click();await expect(page.getByRole('region',{name:'服务器版本'})).toContainText('服务器分类');await expect(page.getByRole('button',{name:'问答分类：本地分类',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'保留备份并载入此版本'}).click();await page.getByRole('dialog').getByRole('button',{name:'确认继续',exact:true}).click();await expect(page.getByRole('button',{name:'问答分类：服务器分类',exact:true})).toBeVisible();await settings(page,'阅读范围与资料');await expect(page.getByLabel('问答排序',{exact:true})).toHaveValue('6');await closeSettings(page);await page.getByText('载入前的输入备份 1',{exact:true}).click();await expect(page.getByLabel('载入前的输入备份 1',{exact:true})).toContainText('本地分类');
});

test('Q&A mismatched save metadata is not acknowledged and exact retry preserves the submitted values',async({page})=>{
 const initial:EditorData={...editorFixture,kind:'qa',qa:{category:'原分类',position:1}};const writes:Record<string,unknown>[]=[];
 await page.route('**/api/admin/editor/*',r=>{const v=r.request().postDataJSON();writes.push(v);return r.fulfill({json:{...initial,...v,sequence:4,qa:writes.length===1?{category:'错误回执',position:99}:v.qa}});});await mount(page,()=>initial);
 await page.getByRole('button',{name:'问答分类：原分类',exact:true}).click();await page.getByRole('dialog',{name:/^(文章设置|问答设置)$/}).getByRole('textbox',{name:'问答分类',exact:true}).fill('新的分类');await closeSettings(page);await expect(page.getByRole('status')).toContainText('保存尚未确认',{timeout:8000});expect(writes).toHaveLength(1);await expect(page.getByRole('button',{name:'问答分类：新的分类',exact:true})).toBeVisible();await page.getByRole('button',{name:'重试保存',exact:true}).click();await expect(page.locator('.save-state')).toContainText('所有修改已保存');expect(writes).toHaveLength(2);expect(writes[1]).toEqual(writes[0]);expect(writes[1].qa).toEqual({category:'新的分类',position:1});
});

test('native editor preserves rich paste, links, formatting and native table through save and reopen',async({page},info)=>{
 let saved=structuredClone(editorFixture);
 await page.route('**/api/admin/editor/*',route=>{const value=route.request().postDataJSON();saved={...saved,...value,sequence:saved.sequence+1};return route.fulfill({json:saved});});
 await mount(page,()=>saved);
 await page.locator('.bn-editor').click();await page.keyboard.press('ControlOrMeta+End');await page.keyboard.press('Enter');
 await page.locator('.bn-editor').evaluate(el=>{const clipboardData=new DataTransfer();clipboardData.setData('text/html','<p><strong>加粗保留</strong> <a href="https://example.com/docs">链接保留</a> <span style="color:rgb(224,62,62);background-color:rgb(251,243,219)">颜色保留</span></p><ul><li>粘贴列表</li></ul><table><tr><th>项目</th><th>说明</th></tr><tr><td>续费</td><td>表格保留</td></tr></table>');clipboardData.setData('text/plain','加粗保留 链接保留 颜色保留 粘贴列表 项目 说明 续费 表格保留');el.dispatchEvent(new ClipboardEvent('paste',{clipboardData,bubbles:true,cancelable:true}));});
 await expect(page.locator('.bn-editor strong')).toContainText('加粗保留');await expect(page.locator('.bn-editor [data-style-type="textColor"]')).toHaveCSS('color','rgb(224, 62, 62)');await expect(page.locator('.bn-editor a[href="https://example.com/docs"]')).toHaveText('链接保留');await expect(page.locator('.bn-editor table')).toContainText('表格保留');
 await expect(page.locator('.save-state')).toContainText('所有修改已保存',{timeout:8000});expect(saved.body).toContain('"type":"table"');expect(saved.body).toContain('"type":"link"');expect(saved.body).toContain('rgb(');
 await page.reload();await expect(page.locator('.bn-editor table')).toContainText('表格保留');await expect(page.locator('.bn-editor a[href="https://example.com/docs"]')).toBeVisible();
 await page.getByRole('button',{name:'预览草稿',exact:true}).click();await expect(page.locator('.editor-preview table')).toContainText('表格保留');await expect(page.locator('.editor-preview a[href="https://example.com/docs"]')).toHaveText('链接保留');
 await page.locator('.editor-preview').scrollIntoViewIfNeeded();await page.screenshot({path:`output/verification/native-editor-${info.project.name}.png`,fullPage:true});
});

test('native table border menu saves selected edges and preview renders the same border',async({page})=>{
 const txt=(text:string)=>[{type:'text',text,styles:{}}];
 let saved={...structuredClone(editorFixture),body:encodeEditorBody([{id:'border-table',type:'table',props:{textColor:'default'},content:{type:'tableContent',columnWidths:[160,160],headerRows:0,rows:[{cells:[txt('左格'),txt('右格')]}]},children:[]}])};
 await page.route('**/api/admin/editor/*',route=>{saved={...saved,...route.request().postDataJSON(),sequence:saved.sequence+1};return route.fulfill({json:saved});});
 await mount(page,()=>saved);const firstCell=page.locator('.bn-editor td').first();await firstCell.hover();await page.locator('.bn-table-cell-handle').click();await page.getByText('边框',{exact:true}).hover();const menu=page.locator('.bn-table-border-menu');await expect(menu).toBeVisible();await menu.getByRole('button',{name:'2px'}).click();await menu.getByLabel('边框颜色').fill('#cc2233');await menu.getByText('下边框',{exact:true}).click();
 await expect.poll(()=>saved.body.includes('borderData'),{timeout:8000}).toBe(true);await expect(page.locator('.save-state')).toContainText('所有修改已保存',{timeout:8000});expect(saved.body).toContain('\\"bottom\\":{\\"width\\":2,\\"color\\":\\"#cc2233\\"}');await expect(firstCell).toHaveCSS('border-bottom-width','2px');await expect(firstCell).toHaveCSS('border-bottom-color','rgb(204, 34, 51)');
 await page.reload();await expect(firstCell).toHaveCSS('border-bottom-width','2px');await expect(firstCell).toHaveCSS('border-bottom-color','rgb(204, 34, 51)');await page.getByRole('button',{name:'预览草稿',exact:true}).click();const previewCell=page.locator('.editor-preview td').first();await expect(previewCell).toHaveCSS('border-bottom-width','2px');await expect(previewCell).toHaveCSS('border-bottom-color','rgb(204, 34, 51)');
});

test('native table menu vertically aligns a merged cell through save, reopen and preview',async({page})=>{
 const txt=(text:string)=>[{type:'text',text,styles:{}}];
 let saved={...structuredClone(editorFixture),body:encodeEditorBody([{id:'aligned-table',type:'table',props:{textColor:'default'},content:{type:'tableContent',columnWidths:[180,240],headerRows:0,rows:[{cells:[{type:'tableCell',props:{rowspan:2,textColor:'default',backgroundColor:'default',textAlignment:'left'},content:txt('合并单元格')},txt('第一行\n增加高度')]},{cells:[txt('第二行\n继续增加高度')]}]},children:[]}])};
 await page.route('**/api/admin/editor/*',route=>{saved={...saved,...route.request().postDataJSON(),sequence:saved.sequence+1};return route.fulfill({json:saved});});
 await mount(page,()=>saved);const mergedCell=page.locator('.bn-editor td[rowspan="2"]').first();await mergedCell.hover();await page.locator('.bn-table-cell-handle').click();await page.getByText('垂直对齐',{exact:true}).hover();await page.getByText('居中',{exact:true}).click();
 await expect.poll(()=>saved.body.includes('verticalAlignData'),{timeout:8000}).toBe(true);await expect(page.locator('.save-state')).toContainText('所有修改已保存',{timeout:8000});expect(saved.body).toContain('\\"0:0\\":\\"middle\\"');await expect(mergedCell).toHaveCSS('vertical-align','middle');
 await page.reload();await expect(page.locator('.bn-editor td[rowspan="2"]').first()).toHaveCSS('vertical-align','middle');await page.getByRole('button',{name:'预览草稿',exact:true}).click();await expect(page.locator('.editor-preview td[rowspan="2"]').first()).toHaveCSS('vertical-align','middle');
});

test('native slash menu and selection toolbar expose original block and formatting controls',async({page})=>{
 await page.route('**/api/admin/editor/*',route=>route.fulfill({json:{...editorFixture,...route.request().postDataJSON(),sequence:4}}));
 await mount(page,()=>editorFixture);const editor=page.locator('.bn-editor');await editor.click();await page.keyboard.press('ControlOrMeta+End');await page.keyboard.press('Enter');await page.keyboard.type('/');
 const menu=page.locator('.bn-suggestion-menu');await expect(menu).toBeVisible();await expect(menu).toContainText('检查清单');await expect(menu).toContainText('引用');await expect(menu).toContainText('音频');await expect(menu).toContainText('表格');
 await expect(menu).not.toContainText('可折叠');await expect(menu).not.toContainText('折叠列表');
 await expect(menu).not.toContainText('扩展内容');await expect(menu).not.toContainText('提示框');await expect(menu).not.toContainText('分页标签');await expect(menu).not.toContainText('操作步骤');await expect(menu).not.toContainText('分栏布局');await expect(menu).not.toContainText('引用文章');await expect(menu).not.toContainText('操作按钮');await expect(menu).not.toContainText('外部内容');await expect(menu).not.toContainText('数学公式');await expect(menu).not.toContainText('流程图');await expect(menu).not.toContainText('资料表格');await expect(menu).not.toContainText('代码示例');
 const items=menu.locator('.bn-suggestion-menu-item'),count=await items.count();expect(count).toBeGreaterThan(1);await expect(menu).toHaveCSS('overflow-y','auto');
 const remainingScroll=()=>menu.evaluate(element=>Math.round(element.scrollHeight-element.clientHeight-element.scrollTop));
 await items.last().scrollIntoViewIfNeeded();
 // The scroll offset is the stable source of truth for this clipping container.
 // Comparing transformed viewport rectangles flakes while the menu animation settles in CI.
 await expect.poll(remainingScroll).toBeLessThanOrEqual(1);
 await page.keyboard.press('Escape');await page.keyboard.press('Backspace');await page.keyboard.insertText('选择文字显示完整工具栏');await page.keyboard.press('Shift+Home');
 await expect(page.locator('.bn-formatting-toolbar')).toBeVisible();await expect(page.locator('.bn-formatting-toolbar button')).not.toHaveCount(6);
 await page.keyboard.press('ArrowRight');await expect(page.locator('.bn-formatting-toolbar')).toBeHidden();
 await editor.locator('[data-content-type="paragraph"]').last().hover();await expect(page.locator('.bn-side-menu')).toBeVisible();
});

test('native slash menu stays closed in table content like BlockNote default UI',async({page})=>{
 const tableBody=encodeEditorBody([{id:'native-table',type:'table',props:{textColor:'default'},content:{type:'tableContent',columnWidths:[120,120],headerRows:0,rows:[{cells:[[{type:'text',text:'',styles:{}}],[{type:'text',text:'',styles:{}}]]}]},children:[]}]);
 await mount(page,()=>({...structuredClone(editorFixture),body:tableBody}));
 const cell=page.locator('.bn-editor td p').first();await cell.click();await page.keyboard.type('/');
 await expect(page.locator('.bn-suggestion-menu')).toBeHidden();
});

test('native checklist toggle heading divider code and merged table keep values after editing and reopening',async({page})=>{
 const txt=(text:string)=>[{type:'text',text,styles:{}}];
 let saved={...structuredClone(editorFixture),body:'JUYU_BLOCKNOTE_V1\n'+JSON.stringify([
  {id:'native-heading',type:'heading',props:{level:6,isToggleable:true},content:txt('六级标题'),children:[{id:'folded',type:'paragraph',content:txt('折叠内容')} ]},
  {id:'native-check',type:'checkListItem',props:{checked:false},content:txt('核对完成')},
  {id:'native-toggle',type:'toggleListItem',content:txt('折叠列表'),children:[{id:'quote-child',type:'quote',content:txt('原生引用')}]},
  {id:'native-divider',type:'divider'},
  {id:'native-code',type:'codeBlock',props:{language:'javascript'},content:txt('const answer = 42;')},
  {id:'native-table',type:'table',content:{type:'tableContent',columnWidths:[120,220],headerRows:1,rows:[{cells:[{type:'tableCell',props:{colspan:2,rowspan:1,textColor:'default',backgroundColor:'blue',textAlignment:'center'},content:txt('合并表头')}]},{cells:[txt('A'),txt('B')]}]}},
 ])};
 await page.route('**/api/admin/editor/*',route=>{saved={...saved,...route.request().postDataJSON(),sequence:saved.sequence+1};return route.fulfill({json:saved});});
 await mount(page,()=>saved);await page.locator('[data-content-type="checkListItem"] input[type="checkbox"]').check();await expect(page.locator('.save-state')).toContainText('所有修改已保存',{timeout:8000});
 expect(saved.body).toContain('"checked":true');expect(saved.body).toContain('"colspan":2');expect(saved.body).toContain('"isToggleable":true');expect(saved.body).toContain('const answer = 42;');
 await page.reload();await expect(page.locator('[data-content-type="checkListItem"] input[type="checkbox"]')).toBeChecked();await expect(page.locator('.bn-editor th[colspan="2"]')).toContainText('合并表头');
 await page.getByRole('button',{name:'预览草稿',exact:true}).click();await expect(page.locator('.editor-preview input[type="checkbox"]')).toBeChecked();await expect(page.locator('.editor-preview th[colspan="2"]')).toContainText('合并表头');
});

test('native image upload panel saves private identity and renders through the administrator asset endpoint',async({page})=>{
 const asset='12345678-1234-1234-1234-123456789abc';
 let saved={...structuredClone(editorFixture),body:'JUYU_BLOCKNOTE_V1\n'+JSON.stringify([{id:'native-image',type:'image',props:{url:'',name:''}}])};
 await page.route('**/api/admin/editor/*',route=>{saved={...saved,...route.request().postDataJSON(),sequence:saved.sequence+1};return route.fulfill({json:saved});});
 await page.route('**/api/admin/media/*/upload',route=>route.fulfill({json:{id:asset,filename:'article-cover.png',mime:'image/png',size:'100',status:'ready'}}));
 await page.route('**/api/admin/assets/*',route=>route.fulfill({path:'tests/fixtures/article-cover.png',contentType:'image/png'}));
 await mount(page,()=>saved);await page.getByText('添加图片',{exact:true}).click();const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'上传图片',exact:true}).click();await (await chooser).setFiles('tests/fixtures/article-cover.png');
 await expect(page.locator('.bn-editor img')).toHaveAttribute('src','/api/admin/assets/'+asset);await expect(page.locator('.save-state')).toContainText('所有修改已保存',{timeout:8000});expect(saved.body).toContain('/api/assets/'+asset);expect(saved.body).not.toContain('/api/admin/assets/');await page.reload();await expect(page.locator('.bn-editor img')).toHaveAttribute('src','/api/admin/assets/'+asset);
});
test('theme image can select a second private image and keeps both references in the draft',async({page})=>{
 const light='11111111-1111-4111-8111-111111111111',dark='22222222-2222-4222-8222-222222222222';
 let saved={...structuredClone(editorFixture),assets:[{id:light,filename:'浅色.png',mime:'image/png',size:'100',status:'ready'},{id:dark,filename:'深色.png',mime:'image/png',size:'100',status:'ready'}]};
 await page.route('**/api/admin/editor/*',route=>{saved={...saved,...route.request().postDataJSON(),sequence:saved.sequence+1};return route.fulfill({json:saved});});
 await page.route('**/api/admin/assets/*',route=>route.fulfill({path:'tests/fixtures/article-cover.png',contentType:'image/png'}));
 await mount(page,()=>saved);await settings(page,'封面与附件');await page.getByLabel('选择本篇文件').selectOption(light);await page.getByRole('button',{name:'插入主题图片'}).click();await closeSettings(page);
 const image=page.locator('.editor-embedded[data-juyu-type="image"]');await image.getByText('编辑此内容块',{exact:true}).click();await image.getByLabel('深色主题图片（可选）').selectOption(dark);
 await expect.poll(()=>saved.body.includes(dark),{timeout:8000}).toBe(true);expect(editorMedia(decodeEditorBody(saved.body)!)).toEqual([expect.objectContaining({type:'image',assetId:light,darkAssetId:dark})]);
});

test('native drag handle changes paragraph order and native menu deletion can be undone',async({page},info)=>{
 let saved={...structuredClone(editorFixture),body:'JUYU_BLOCKNOTE_V1\n'+JSON.stringify(['第一段','第二段','第三段'].map((text,i)=>({id:'drag-'+i,type:'paragraph',content:[{type:'text',text,styles:{}}]})))};
 await page.route('**/api/admin/editor/*',route=>{saved={...saved,...route.request().postDataJSON(),sequence:saved.sequence+1};return route.fulfill({json:saved});});
 await mount(page,()=>saved);const first=page.locator('.bn-editor [data-content-type="paragraph"]').filter({hasText:'第一段'}),last=page.locator('.bn-editor [data-content-type="paragraph"]').filter({hasText:'第三段'});
 await first.hover();const handle=page.locator('.bn-side-menu [draggable="true"]');await expect(handle).toBeVisible();const bounds=await last.boundingBox(),origin=await handle.boundingBox();await page.mouse.move(origin!.x+origin!.width/2,origin!.y+origin!.height/2);await page.mouse.down();await page.mouse.move(origin!.x+origin!.width/2+12,origin!.y+origin!.height/2,{steps:3});await page.mouse.move(bounds!.x+80,bounds!.y+bounds!.height+8,{steps:12});await page.mouse.move(bounds!.x+82,bounds!.y+bounds!.height+9,{steps:3});await page.mouse.up();
 await expect.poll(()=>saved.body.indexOf('第一段')>saved.body.indexOf('第二段'),{timeout:8000}).toBe(true);
 await page.reload();await expect(page.locator('.bn-editor [data-content-type="paragraph"]').first()).toContainText('第二段');
 await page.locator('.bn-editor [data-content-type="paragraph"]').first().hover();await page.locator('.bn-side-menu [draggable="true"]').click();await page.getByRole('menuitem',{name:'删除',exact:true}).click();
 await expect.poll(()=>saved.body.includes('第二段')).toBe(false);await page.locator('.bn-editor').click();await page.keyboard.press('ControlOrMeta+z');await expect.poll(()=>saved.body.includes('第二段')).toBe(true);
 const nodes=JSON.parse(saved.body.split('\n').slice(1).join('\n'));expect(new Set(nodes.map((b:{id:string})=>b.id)).size).toBe(nodes.length);
 await page.locator('.editor-canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`output/verification/native-controls-${info.project.name}.png`,fullPage:false});
});

test('native image caption rename and resize persist through reopening',async({page})=>{
 const asset='12345678-1234-1234-1234-123456789abc';
 let saved={...structuredClone(editorFixture),body:'JUYU_BLOCKNOTE_V1\n'+JSON.stringify([{id:'native-image',type:'image',props:{url:'/api/assets/'+asset,name:'原图',previewWidth:200}}])};
 await page.route('**/api/admin/editor/*',route=>{saved={...saved,...route.request().postDataJSON(),sequence:saved.sequence+1};return route.fulfill({json:saved});});
 await page.route('**/api/admin/assets/*',route=>route.fulfill({path:'tests/fixtures/article-cover.png',contentType:'image/png'}));
 await mount(page,()=>saved);
 const img=page.locator('.bn-editor img');await img.click();await page.getByRole('button',{name:'重命名图片',exact:true}).click();await page.getByPlaceholder('重命名图片',{exact:true}).fill('更新图片名称');await page.getByPlaceholder('重命名图片',{exact:true}).press('Enter');
 await img.click();await page.getByRole('button',{name:'编辑标题',exact:true}).click();await page.getByPlaceholder('编辑标题',{exact:true}).fill('图片说明保留');await page.getByPlaceholder('编辑标题',{exact:true}).press('Enter');
 await img.hover();const handle=page.locator('.bn-editor .bn-resize-handle').last();await expect(handle).toBeVisible();const point=await handle.boundingBox();await page.mouse.move(point!.x+point!.width/2,point!.y+point!.height/2);await page.mouse.down();await page.mouse.move(point!.x+point!.width/2-40,point!.y+point!.height/2,{steps:8});await page.mouse.up();
 await expect.poll(()=>{const block=JSON.parse(saved.body.slice(saved.body.indexOf('\n')+1))[0];return block.props.name==='更新图片名称'&&block.props.caption==='图片说明保留'&&block.props.previewWidth<200;},{timeout:8000}).toBe(true);
 const width=JSON.parse(saved.body.slice(saved.body.indexOf('\n')+1))[0].props.previewWidth;
 await page.reload();await expect(page.locator('.bn-editor .bn-file-caption')).toHaveText('图片说明保留');await expect(page.locator('.bn-editor img')).toHaveAttribute('alt','更新图片名称');expect(JSON.parse(saved.body.slice(saved.body.indexOf('\n')+1))[0].props.previewWidth).toBe(width);
});

test('native image preview preserves BlockNote width and left center right alignment',async({page})=>{
 const asset='12345678-1234-1234-1234-123456789abc';
 const image=(id:string,name:string,textAlignment:'left'|'center'|'right')=>({id,type:'image',props:{url:'/api/assets/'+asset,name,previewWidth:180,textAlignment},children:[]});
 const spacer=(id:string)=>({id,type:'paragraph',props:{textAlignment:'left',textColor:'default',backgroundColor:'default'},content:[],children:[]});
 const saved={...structuredClone(editorFixture),body:'JUYU_BLOCKNOTE_V1\n'+JSON.stringify([image('left-image','左图','left'),spacer('space-one'),image('center-image','中图','center'),spacer('space-two'),image('right-image','右图','right')])};
 await page.route('**/api/admin/assets/*',route=>route.fulfill({path:'tests/fixtures/article-cover.png',contentType:'image/png'}));
 await mount(page,()=>saved);await page.getByRole('button',{name:'预览草稿',exact:true}).click();
 for(const [name,alignment] of [['左图','start'],['中图','center'],['右图','end']] as const){
  const figure=page.getByRole('button',{name:`放大图片：${name}`}).locator('..');
  await expect(figure).toHaveCSS('width','180px');
  await expect(figure).toHaveCSS('justify-self',alignment);
 }
});

test('BlockNote image alignment control autosaves and matches the draft preview',async({page})=>{
 const asset='12345678-1234-1234-1234-123456789abc';
 let saved={...structuredClone(editorFixture),body:'JUYU_BLOCKNOTE_V1\n'+JSON.stringify([{id:'native-image',type:'image',props:{url:'/api/assets/'+asset,name:'对齐测试图',previewWidth:180,textAlignment:'left'},children:[]}])};
 await page.route('**/api/admin/editor/*',route=>{saved={...saved,...route.request().postDataJSON(),sequence:saved.sequence+1};return route.fulfill({json:saved});});
 await page.route('**/api/admin/assets/*',route=>route.fulfill({path:'tests/fixtures/article-cover.png',contentType:'image/png'}));
 await mount(page,()=>saved);
 await page.locator('.bn-editor img').click();
 await page.getByRole('button',{name:'右对齐',exact:true}).click();
 await expect.poll(()=>JSON.parse(saved.body.slice(saved.body.indexOf('\n')+1))[0].props.textAlignment,{timeout:8000}).toBe('right');
 await page.getByRole('button',{name:'预览草稿',exact:true}).click();
 const figure=page.getByRole('button',{name:'放大图片：对齐测试图'}).locator('..');
 await expect(figure).toHaveCSS('width','180px');
 await expect(figure).toHaveCSS('justify-self','end');
});

test('R19 opt-in copy survives reload and restore waits for explicit save',async({page},info)=>{
 let writes=0;await page.route('**/api/admin/editor/*',r=>{if(r.request().method()==='GET')return r.fulfill({json:editorFixture});writes++;return r.fulfill({status:503,json:{error:'UNAVAILABLE'}});});
 await mount(page,()=>editorFixture);await page.locator('.editor-input-backup > summary').click();await page.getByRole('button',{name:'在此设备开启恢复'}).click();
 await typeText(page,' 需要恢复的红字内容');await expect.poll(()=>page.evaluate(()=>Object.values(localStorage).some(v=>v.includes('需要恢复的红字内容')))).toBe(true);
 page.on('dialog',d=>d.accept());await page.reload();await expect(page.getByRole('region',{name:'可恢复输入'})).toBeVisible();await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`output/verification/R19-recovery-${info.project.name}.png`,fullPage:true});
 await page.getByRole('button',{name:'恢复到编辑区'}).click();await page.getByRole('button',{name:'确认继续',exact:true}).click();
 await expect(page.locator('.bn-editor')).toContainText('需要恢复的红字内容');await expect(page.getByText('已恢复输入，自动保存已暂停。请核对后点击立即保存。')).toBeVisible();
 const before=writes;await page.waitForTimeout(1500);expect(writes).toBe(before);
 await page.locator('.editor-input-backup > summary').click();await page.getByRole('button',{name:'关闭并清除本机副本'}).click();await page.getByRole('button',{name:'确认继续',exact:true}).click();
 expect(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('juyu:editor-recovery:')))).toEqual([]);
});
test('R19 changed server version retains copy without replacing editor',async({page})=>{
 await page.route('**/api/admin/editor/*',r=>r.request().method()==='GET'?r.fulfill({json:{...editorFixture,sequence:9}}):r.fulfill({status:503,json:{error:'UNAVAILABLE'}}));
 await mount(page,()=>editorFixture);await page.locator('.editor-input-backup > summary').click();await page.getByRole('button',{name:'在此设备开启恢复'}).click();await typeText(page,' 不要覆盖最新版本');
 await expect.poll(()=>page.evaluate(()=>Object.values(localStorage).some(v=>v.includes('不要覆盖最新版本')))).toBe(true);page.on('dialog',d=>d.accept());await page.reload();
 await page.getByRole('button',{name:'恢复到编辑区'}).click();await page.getByRole('button',{name:'确认继续',exact:true}).click();
 await expect(page.getByText('无法安全恢复：服务器版本或权限可能已变化。副本仍保留，请复制后与最新文章对照。')).toBeVisible();
 await expect(page.locator('.bn-editor')).not.toContainText('不要覆盖最新版本');await expect(page.getByLabel('本机恢复副本')).toContainText('不要覆盖最新版本');
});

test('R19 unsaved new article reopens its original recovery identity',async({page})=>{
 await page.route('**/api/admin/editor/*',r=>r.fulfill({status:404,json:{error:'NOT_FOUND'}}));await mount(page,()=>null);
 await page.locator('.editor-input-backup > summary').click();await page.getByRole('button',{name:'在此设备开启恢复'}).click();await typeText(page,' 尚未命名的新文章');
 await expect.poll(()=>page.evaluate(()=>Object.values(localStorage).some(v=>v.includes('尚未命名的新文章')))).toBe(true);
 page.on('dialog',d=>d.accept());await page.reload();await page.getByRole('button',{name:'恢复到编辑区'}).click();await page.getByRole('button',{name:'确认继续',exact:true}).click();await expect(page.locator('.bn-editor')).toContainText('尚未命名的新文章');
});

test('invalid file format is an error notification regardless of Chinese wording',async({page})=>{
 await mount(page,()=>editorFixture);await settings(page,'封面与附件');await page.getByLabel('上传文件',{exact:true}).setInputFiles({name:'bad.exe',mimeType:'application/octet-stream',buffer:Buffer.from('invalid')});
 await expect(page.locator('.juyu-toast.error')).toContainText('文件格式或大小不符合要求');await expect(page.locator('.juyu-toast.success')).toHaveCount(0);
});


// Publication recovery: exercise the real editor; only the HTTP boundary is simulated.
test('direct publication preflight failure permits a safe recheck without discarding input or submitting a write',async({page})=>{
 const article={...structuredClone(editorFixture),canDirectPublish:true};let healthy=false;const writes:unknown[]=[];
 await page.route('**/api/admin/review/*/publication',r=>r.request().method()==='GET'?r.fulfill(healthy?{json:{article,revision:1,approval:null,canQueue:false,canPublish:false,canDirectPublish:true,history:[],historyMore:false}}:{status:503,json:{error:'REVIEW_UNAVAILABLE'}}):(writes.push(r.request().postDataJSON()),r.fulfill({json:{documentId:article.documentId,sequence:4,revision:1,action:'direct_publish',status:'published',publishedRevision:1,approvedBy:'super-a'}})));
 await mount(page,()=>article);await page.getByRole('button',{name:'批准并发布',exact:true}).click();const dialog=page.getByRole('dialog',{name:'批准并发布'});await dialog.getByRole('button',{name:'确认发布',exact:true}).click();
 await expect(dialog).toBeVisible();await expect(dialog.getByRole('alert')).toContainText('未能读取');await expect(dialog.getByRole('button',{name:'取消',exact:true})).toBeEnabled();await expect(page.locator('.bn-editor')).toHaveAttribute('contenteditable','true');expect(writes).toHaveLength(0);
 await dialog.getByRole('button',{name:'取消',exact:true}).click();await expect(page.getByRole('button',{name:'批准并发布',exact:true})).toBeEnabled();await page.getByRole('button',{name:'批准并发布',exact:true}).click();healthy=true;await dialog.getByRole('button',{name:'重新核对发布状态',exact:true}).click();await expect(dialog.getByRole('button',{name:'确认发布',exact:true})).toBeEnabled();expect(writes).toHaveLength(0);await expect(page.getByRole('textbox',{name:'文章标题'})).toHaveValue('编辑测试文章');
 await dialog.getByRole('button',{name:'确认发布',exact:true}).click();await expect(page.locator('.editor-notices').getByRole('status')).toContainText('已由你的 Super Admin');expect(writes).toEqual([{action:'direct_publish',expectedSequence:3}]);
});
test('direct publication version conflict offers a server comparison and keeps an input backup when loading the newer draft',async({page})=>{
 const article={...structuredClone(editorFixture),canDirectPublish:true};const newer={...article,title:'另一个窗口的新草稿',body:'服务器的新正文',sequence:4};const writes:unknown[]=[];
 await page.route('**/api/admin/editor/*',r=>r.fulfill({json:newer}));
 await page.route('**/api/admin/review/*/publication',r=>r.request().method()==='GET'?r.fulfill({json:{article:newer,revision:2,approval:null,canQueue:false,canPublish:false,canDirectPublish:true,history:[],historyMore:false}}):(writes.push(r.request().postDataJSON()),r.fulfill({json:{documentId:article.documentId,sequence:5,revision:2,action:'direct_publish',status:'published',publishedRevision:2,approvedBy:'super-a'}})));
 await mount(page,()=>article);await page.getByRole('button',{name:'批准并发布',exact:true}).click();const dialog=page.getByRole('dialog',{name:'批准并发布'});await dialog.getByRole('button',{name:'确认发布',exact:true}).click();
 await expect(dialog.getByRole('alert')).toContainText('版本');await expect(dialog.getByRole('alert')).not.toContainText('登录状态');expect(writes).toHaveLength(0);
 await dialog.getByRole('button',{name:'保留输入并对照服务器版本',exact:true}).click();const recovery=page.getByRole('region',{name:'保存恢复'});await expect(recovery.getByRole('heading',{name:newer.title})).toBeVisible();await expect(page.getByRole('textbox',{name:'文章标题'})).toHaveValue(article.title);
 await recovery.getByRole('button',{name:'保留备份并载入此版本',exact:true}).click();await page.locator('dialog.juyu-confirm').getByRole('button',{name:'确认继续'}).click();await expect(page.getByRole('textbox',{name:'文章标题'})).toHaveValue(newer.title);
 const backup=page.getByRole('textbox',{name:'载入前的输入备份 1'});await page.getByText('载入前的输入备份 1',{exact:true}).click();await expect(backup).toHaveValue(/编辑测试文章/);await expect(backup).toHaveValue(/原始正文/);
 await page.getByRole('button',{name:'批准并发布',exact:true}).click();await page.getByRole('dialog',{name:'批准并发布'}).getByRole('button',{name:'确认发布',exact:true}).click();await expect(page.locator('.editor-notices').getByRole('status')).toContainText('已由你的 Super Admin');expect(writes).toEqual([{action:'direct_publish',expectedSequence:4}]);
});
test('direct publication attachment rejection remains recoverable on the same page after files become ready',async({page})=>{
 const article={...structuredClone(editorFixture),canDirectPublish:true};let ready=false;const writes:unknown[]=[];
 await page.route('**/api/admin/review/*/publication',r=>{if(r.request().method()==='GET')return r.fulfill({json:{article,revision:1,approval:null,canQueue:false,canPublish:false,canDirectPublish:true,history:[],historyMore:false}});writes.push(r.request().postDataJSON());return r.fulfill(ready?{json:{documentId:article.documentId,sequence:4,revision:1,action:'direct_publish',status:'published',publishedRevision:1,approvedBy:'super-a'}}:{status:409,json:{error:'UPLOAD_IN_PROGRESS'}});});
 await mount(page,()=>article);await page.getByRole('button',{name:'批准并发布',exact:true}).click();const dialog=page.getByRole('dialog',{name:'批准并发布'});await dialog.getByRole('button',{name:'确认发布',exact:true}).click();await expect(dialog).toBeVisible();await expect(dialog.getByRole('alert')).toContainText('附件');await expect(page.getByRole('button',{name:'批准并发布',exact:true})).toBeVisible();
 ready=true;await dialog.getByRole('button',{name:'重新核对发布状态',exact:true}).click();await expect(dialog.getByRole('button',{name:'确认发布',exact:true})).toBeEnabled();expect(writes).toHaveLength(1);await dialog.getByRole('button',{name:'确认发布',exact:true}).click();await expect(page.locator('.editor-notices').getByRole('status')).toContainText('已由你的 Super Admin');expect(writes).toEqual([{action:'direct_publish',expectedSequence:3},{action:'direct_publish',expectedSequence:3}]);
});
test('an unconfirmed direct publication locks editing and preserves the exact operation through a later conflict',async({page})=>{
 const article={...structuredClone(editorFixture),canDirectPublish:true};const writes:unknown[]=[];
 await page.route('**/api/admin/review/*/publication',r=>{if(r.request().method()==='GET')return r.fulfill({json:{article,revision:1,approval:null,canQueue:false,canPublish:false,canDirectPublish:true,history:[],historyMore:false}});writes.push(r.request().postDataJSON());return writes.length===1?r.abort('failed'):writes.length===2?r.fulfill({status:409,json:{error:'CONFLICT'}}):r.fulfill({json:{documentId:article.documentId,sequence:4,revision:1,action:'direct_publish',status:'published',publishedRevision:1,approvedBy:'super-a'}});});
 await mount(page,()=>article);await page.getByRole('button',{name:'批准并发布',exact:true}).click();const dialog=page.getByRole('dialog',{name:'批准并发布'});await dialog.getByRole('button',{name:'确认发布',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('尚未确认');await expect(page.locator('.bn-editor')).toHaveAttribute('contenteditable','false');await expect(dialog.getByRole('button',{name:'取消',exact:true})).toBeDisabled();await expect(dialog.getByRole('button',{name:'重新核对发布状态',exact:true})).toBeDisabled();
 await dialog.getByRole('button',{name:'重试原发布',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('尚未确认');await dialog.getByRole('button',{name:'重试原发布',exact:true}).click();await expect(page.locator('.editor-notices').getByRole('status')).toContainText('已由你的 Super Admin');expect(writes).toEqual(Array(3).fill({action:'direct_publish',expectedSequence:3}));
});
test('an open publication confirmation explains uploading even when the draft is already saved',async({page})=>{
 const article={...structuredClone(editorFixture),canDirectPublish:true};let release!:()=>void;const held=new Promise<void>(r=>{release=r;});
 await page.route('**/api/admin/media/*/upload',async r=>{await held;return r.fulfill({json:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',filename:'sample.png',mime:'image/png',size:'68',status:'ready'}});});
 await mount(page,()=>article);await page.getByRole('button',{name:'批准并发布',exact:true}).click();await settings(page,'封面与附件');await page.getByRole('button',{name:'关闭文章设置',exact:true}).click();
 // Start the real upload from the settings input, then return to the open confirmation.
 await settings(page,'封面与附件');await page.getByLabel('上传文件',{exact:true}).setInputFiles({name:'sample.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9jjCcAAAAASUVORK5CYII=','base64')});await closeSettings(page);
 const dialog=page.getByRole('dialog',{name:'批准并发布'});await expect(page.locator('.save-state')).toContainText('所有修改已保存');await expect(dialog.getByRole('button',{name:'确认发布',exact:true})).toBeDisabled();await expect(dialog.getByRole('status')).toContainText('上传');release();await expect(dialog.getByRole('button',{name:'确认发布',exact:true})).toBeEnabled();
});

// Already-open tools must obey the same publication lock as the writing surface.
test('direct publication locks already-open insertion tools while sending and while the result is uncertain',async({page})=>{
 const article={...structuredClone(editorFixture),canDirectPublish:true};let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/api/admin/review/*/publication',async route=>{if(route.request().method()==='GET')return route.fulfill({json:{article,revision:1,approval:null,canQueue:false,canPublish:false,canDirectPublish:true,history:[],historyMore:false}});await held;return route.abort('failed');});
 await mount(page,()=>article);await page.getByRole('navigation',{name:'编辑工具'}).getByRole('button',{name:'内容插入',exact:true}).click();const panel=page.getByRole('region',{name:'内容插入'});const before=await page.locator('.bn-block-outer').count();
 await page.getByRole('button',{name:'批准并发布',exact:true}).click();const dialog=page.getByRole('dialog',{name:'批准并发布'});await dialog.getByRole('button',{name:'确认发布',exact:true}).click();await expect(dialog.getByRole('button',{name:'正在发布…',exact:true})).toBeVisible();
 for(const name of ['提示框','代码块','分页标签','折叠内容'])await expect(panel.getByRole('button',{name:new RegExp('^'+name)})).toBeDisabled();release();await expect(dialog.getByRole('alert')).toContainText('尚未确认');
 for(const name of ['提示框','代码块','分页标签','折叠内容'])await expect(panel.getByRole('button',{name:new RegExp('^'+name)})).toBeDisabled();expect(await page.locator('.bn-block-outer').count()).toBe(before);
});
test('direct publication locks the trash action while sending and while the result is uncertain',async({page})=>{
 const article={...structuredClone(editorFixture),canDirectPublish:true};let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});let trashWrites=0;
 await page.route('**/api/admin/lifecycle/*',route=>{trashWrites++;return route.abort('failed');});
 await page.route('**/api/admin/review/*/publication',async route=>{if(route.request().method()==='GET')return route.fulfill({json:{article,revision:1,approval:null,canQueue:false,canPublish:false,canDirectPublish:true,history:[],historyMore:false}});await held;return route.abort('failed');});
 await mount(page,()=>article);await page.getByRole('button',{name:'批准并发布',exact:true}).click();const dialog=page.getByRole('dialog',{name:'批准并发布'});await dialog.getByRole('button',{name:'确认发布',exact:true}).click();await expect(dialog.getByRole('button',{name:'正在发布…',exact:true})).toBeVisible();
 await settings(page);await expect(page.getByRole('button',{name:'删除文章',exact:true})).toBeDisabled();await closeSettings(page);release();await expect(dialog.getByRole('alert')).toContainText('尚未确认');await settings(page);await expect(page.getByRole('button',{name:'删除文章',exact:true})).toBeDisabled();expect(trashWrites).toBe(0);
});

for(const phase of ['sending','uncertain'] as const)test(`a delayed local recovery keeps its copy when direct publication becomes ${phase}`,async({page})=>{
 const article={...structuredClone(editorFixture),canDirectPublish:true};let releaseRead!:()=>void;const heldRead=new Promise<void>(resolve=>{releaseRead=resolve;});let releasePublish!:()=>void;const heldPublish=new Promise<void>(resolve=>{releasePublish=resolve;});let readStarted=false;
 await page.route('**/api/admin/editor/*',async route=>{if(route.request().method()!=='GET')return route.abort('failed');readStarted=true;await heldRead;return route.fulfill({json:article});});
 await page.route('**/api/admin/review/*/publication',async route=>{if(route.request().method()==='GET')return route.fulfill({json:{article,revision:1,approval:null,canQueue:false,canPublish:false,canDirectPublish:true,history:[],historyMore:false}});await heldPublish;return route.abort('failed');});
 await mount(page,()=>article);await page.locator('.editor-input-backup > summary').click();await page.getByRole('button',{name:'在此设备开启恢复'}).click();await typeText(page,' 等待中的本机恢复输入');await expect.poll(()=>page.evaluate(()=>Object.values(localStorage).some(v=>v.includes('等待中的本机恢复输入')))).toBe(true);
 page.on('dialog',dialog=>dialog.accept());await page.reload();await page.getByRole('button',{name:'恢复到编辑区',exact:true}).click();await page.locator('dialog.juyu-confirm').getByRole('button',{name:'确认继续'}).click();await expect.poll(()=>readStarted).toBe(true);
 await page.getByRole('button',{name:'批准并发布',exact:true}).click();const dialog=page.getByRole('dialog',{name:'批准并发布'});await dialog.getByRole('button',{name:'确认发布',exact:true}).click();await expect(dialog.getByRole('button',{name:'正在发布…',exact:true})).toBeVisible();
 if(phase==='uncertain'){releasePublish();await expect(dialog.getByRole('alert')).toContainText('尚未确认');}
 releaseRead();const recovery=page.locator('.editor-recovery-panel');await expect(recovery.getByRole('status')).toContainText('无法安全恢复');await expect(page.getByRole('region',{name:'可恢复输入'})).toBeVisible();await page.getByText('查看副本以便手动复制',{exact:true}).click();await expect(page.getByRole('textbox',{name:'本机恢复副本'})).toHaveValue(/等待中的本机恢复输入/);await expect(page.locator('.bn-editor')).not.toContainText('等待中的本机恢复输入');await expect(page.getByRole('button',{name:'恢复到编辑区',exact:true})).toBeDisabled();
 if(phase==='sending'){releasePublish();await expect(dialog.getByRole('alert')).toContainText('尚未确认');}
});

test('official category multi-select saves real draft assignments and enforces twenty selections',async({page})=>{
 const categoryOptions=Array.from({length:21},(_,i)=>({id:`00000000-0000-4000-8000-${String(i+300).padStart(12,'0')}`,version:1,name:`目录 ${i+1}`,parentId:null,position:i,audience:'staff' as const,enabled:true}));
 let saved={...structuredClone(editorFixture),categoryOptions,categoryIds:categoryOptions.slice(0,20).map(x=>x.id)};const writes:unknown[]=[];
 await page.route('**/api/admin/editor/*',route=>{const write=route.request().postDataJSON();writes.push(write);saved={...saved,...write,sequence:saved.sequence+1};return route.fulfill({json:saved});});
 await mount(page,()=>saved);await settings(page,'内容与访问');const dialog=page.getByRole('dialog',{name:'文章设置',exact:true});
 await dialog.getByRole('button',{name:/选择目录分类/}).click();const extra=dialog.getByRole('option',{name:'目录 21 · 全体员工',exact:true});await expect(extra).toBeDisabled();
 await dialog.getByRole('option',{name:'目录 1 · 全体员工',exact:true}).click();await expect(extra).toBeEnabled();await extra.click();
 await expect.poll(()=>saved.categoryIds.includes(categoryOptions[20].id),{timeout:8000}).toBe(true);expect(saved.categoryIds).toHaveLength(20);expect(saved.categoryIds).not.toContain(categoryOptions[0].id);expect(writes.length).toBeGreaterThan(0);
 await page.reload();await settings(page,'内容与访问');await dialog.getByRole('button',{name:/选择目录分类/}).click();await expect(extra).toHaveAttribute('aria-selected','true');
});

test('editor copy acknowledges the complete current draft including unsaved metadata and body',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{await new Promise(resolve=>setTimeout(resolve,200));(window as Window&{copiedDraft?:string}).copiedDraft=text;}}}));
 await page.route('**/api/admin/editor/*',route=>route.fulfill({status:503,json:{error:'SAVE_FAILED'}}));
 await mount(page,()=>structuredClone(editorFixture));await page.getByRole('textbox',{name:'文章标题',exact:true}).fill('尚未保存的标题');await typeText(page,' 完整未保存正文');
 await settings(page);await page.getByRole('button',{name:'复制当前输入',exact:true}).click();
 await expect(page.getByRole('button',{name:'已复制',exact:true})).toHaveAttribute('data-copied','true');
 const copied=await page.evaluate(()=>(window as Window&{copiedDraft?:string}).copiedDraft);const snapshot=JSON.parse(copied!);
 expect(snapshot).toMatchObject({title:'尚未保存的标题',documentId:editorFixture.documentId,kind:'article',audience:'staff'});expect(snapshot.body).toBeInstanceOf(Array);expect(JSON.stringify(snapshot.body)).toContain('完整未保存正文');
 await closeSettings(page);await expect(page.getByRole('textbox',{name:'文章标题',exact:true})).toHaveValue('尚未保存的标题');await expect(page.locator('.bn-editor')).toContainText('完整未保存正文');
});


test('clipboard fallback selects the full draft inside the modal settings dialog',async({page})=>{
 await page.addInitScript(()=>{
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('denied');}}});
  document.execCommand=()=>{
   const target=document.activeElement;
   if(!(target instanceof HTMLTextAreaElement))return false;
   (window as Window&{copiedDraft?:string}).copiedDraft=target.value.slice(target.selectionStart,target.selectionEnd);return true;
  };
 });
 await mount(page,()=>structuredClone(editorFixture));await settings(page);await page.getByRole('button',{name:'复制当前输入',exact:true}).click();
 await expect(page.getByRole('button',{name:'已复制',exact:true})).toHaveAttribute('data-copied','true');
 const copied=await page.evaluate(()=>(window as Window&{copiedDraft?:string}).copiedDraft);expect(JSON.parse(copied!)).toMatchObject({title:editorFixture.title,documentId:editorFixture.documentId});
 await expect(page.getByRole('dialog',{name:'文章设置',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'已复制',exact:true})).toBeFocused();
});
