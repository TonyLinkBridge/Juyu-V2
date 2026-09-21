import {readFile} from 'node:fs/promises';
import {test,expect,type Page} from '@playwright/test';
import {editorBrowserBundle,editorFixture} from '../helpers/editor-browser';
import type {EditorData} from '../../src/editor/contract';
import {decodeEditorBody,encodeEditorBody,editorMedia} from '../../src/editor/document';
import {annotationText} from '../../src/editor/annotation';
import {inlineEmbed} from '../../src/editor/inline-embed';
let bundle:Awaited<ReturnType<typeof editorBrowserBundle>>;
test.beforeAll(async()=>{bundle=await editorBrowserBundle();});
async function mount(page:Page,initial:()=>EditorData|null,newReference:boolean|'qa'=false){
 await page.route('**/__editor_assets/*.js',async route=>{const file=new URL(route.request().url()).pathname.split('/').pop()!;if(!/^[a-zA-Z0-9_.-]+\.js$/.test(file))return route.abort();return route.fulfill({contentType:'application/javascript',body:await readFile('output/verification/editor-fixture/'+file,'utf8')});});
 await page.route(url=>url.pathname==='/__editor_fixture'||url.pathname==='/admin/editor',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.css}</style></head><body><main class="editor-main"><h1>文章编辑 · 本地样例</h1><script type="application/json" id="data">${JSON.stringify(initial()).replace(/</g,'\\u003c')}</script><div id="editor"></div><a href="/leaving">离开编辑页</a></main><script>${bundle.script.replace(/<\/script/gi,'<\\/script')}</script></body></html>`}));
 await page.goto('/__editor_fixture'+(newReference==='qa'?'?kind=qa':newReference?'?kind=reference':''));await expect(page.locator('.bn-editor')).toBeVisible();
}
async function typeText(page:Page,text:string){const area=page.locator('.bn-editor[contenteditable="true"]');await area.click();await area.press('ControlOrMeta+End');await page.keyboard.insertText(text);}
async function settings(page:Page,section='保存与管理'){
 await page.getByRole('button',{name:/^(文章设置|问答设置)$/}).click();
 await page.getByRole('dialog',{name:'文章设置',exact:true}).getByRole('button',{name:new RegExp('^'+section)}).click();
}
async function closeSettings(page:Page){await page.getByRole('button',{name:'关闭文章设置',exact:true}).click();}
async function slash(page:Page,name:string){await page.locator('.bn-editor').click();await page.keyboard.press('ControlOrMeta+End');await page.keyboard.press('Enter');await page.keyboard.type('/');await page.locator('.bn-suggestion-menu').getByText(name,{exact:true}).click();}
test('release note autosaves, survives reload, and stays editable only before review',async({page})=>{
 let saved=structuredClone(editorFixture);
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
 const english={...structuredClone(editorFixture),locale:'en' as const,translationOf:'11111111-1111-4111-8111-111111111111',title:'How to update your email'};
 await mount(page,()=>english);
 await expect(page.getByRole('button',{name:'Preview draft'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Article settings',exact:true})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Article title'})).toHaveValue('How to update your email');
 await page.getByRole('button',{name:'Article settings',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Article settings'}).getByRole('button',{name:'Save and manage'})).toBeVisible();
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
test('inline annotation saves selected words and opens as a note in the reader preview',async({page})=>{
 let saved=structuredClone(editorFixture);
 await page.route('**/api/admin/editor/*',route=>{const value=route.request().postDataJSON();saved={...saved,...value,sequence:saved.sequence+1};return route.fulfill({json:saved});});
 await mount(page,()=>saved);
 await page.locator('.bn-editor').click();await page.keyboard.press('ControlOrMeta+End');await page.keyboard.press('Enter');await page.keyboard.insertText('需要说明的词');
 for(let index=0;index<'需要说明的词'.length;index++)await page.keyboard.press('Shift+ArrowLeft');
 await page.getByRole('button',{name:'添加行内注释'}).click();
 const dialog=page.getByRole('dialog',{name:'添加行内注释'});
 await expect(dialog).toBeVisible();await dialog.getByRole('textbox',{name:'注释内容'}).fill('员工点击后看到的解释');await dialog.getByRole('button',{name:'插入注释'}).click();
 await expect(page.locator('.save-state')).toContainText('所有修改已保存',{timeout:8000});
 const blocks=decodeEditorBody(saved.body);expect(blocks).not.toBeNull();if(!blocks)throw new Error('saved body is not structured');
 const link=blocks.flatMap(block=>block.type==='paragraph'?block.content:[]).find(inline=>inline.type==='link'&&inline.content.some(item=>item.text==='需要说明的词'));
 expect(link?.type).toBe('link');if(link?.type==='link')expect(annotationText(link.href)).toBe('员工点击后看到的解释');
 await page.getByRole('button',{name:'预览草稿',exact:true}).click();
 const trigger=page.locator('.editor-preview .inline-annotation-trigger');await expect(trigger).toContainText('需要说明的词');await trigger.click();await expect(page.locator('.editor-preview [role="note"]')).toContainText('员工点击后看到的解释');
 await page.reload();await expect(page.locator('.bn-editor')).toContainText('需要说明的词');
});
test('inline icon, formula and image keep their meaning after autosave and preview',async({page})=>{
 const imageId='00000000-0000-4000-8000-000000000081';
 let saved={...structuredClone(editorFixture),assets:[{id:imageId,filename:'verification.png',mime:'image/png',size:'100',status:'ready'}]};
 await page.route('**/api/admin/editor/*',route=>{const value=route.request().postDataJSON();saved={...saved,...value,sequence:saved.sequence+1};return route.fulfill({json:saved});});
 await mount(page,()=>saved);
 await page.locator('.bn-editor').click();await page.keyboard.press('ControlOrMeta+End');await page.keyboard.press('Enter');
 for(const kind of ['icon','math','image'] as const){
  await page.getByRole('button',{name:'插入行内元素'}).click();
  const dialog=page.getByRole('dialog',{name:'插入行内元素'});await dialog.getByRole('combobox',{name:'行内元素类型'}).selectOption(kind);
  if(kind==='icon')await dialog.getByRole('combobox',{name:'行内图标'}).selectOption('shield');
  if(kind==='math')await dialog.getByRole('textbox',{name:'行内公式'}).fill('x^2');
  if(kind==='image'){await dialog.getByRole('combobox',{name:'行内图片',exact:true}).selectOption(imageId);await dialog.getByRole('textbox',{name:'行内图片说明'}).fill('验证截图');}
  await dialog.getByRole('button',{name:'插入正文'}).click();
  await expect(page.locator('.save-state')).toContainText('所有修改已保存',{timeout:8000});
 }
 const blocks=decodeEditorBody(saved.body);expect(blocks).not.toBeNull();if(!blocks)throw new Error('missing inline body');
 const embeds=blocks.flatMap(block=>block.type==='paragraph'?block.content:[]).filter(item=>item.type==='link').map(item=>inlineEmbed(item.href)).filter(Boolean);
 expect(embeds).toEqual([{type:'icon',icon:'shield'},{type:'math',source:'x^2'},{type:'image',assetId:imageId}]);
 await expect(page.locator('.editor-canvas .inline-reader-icon svg')).toBeVisible();
 await expect(page.locator('.editor-canvas .inline-reader-math math')).toBeVisible();
 await expect(page.locator('.editor-canvas .inline-reader-image')).toHaveAttribute('alt','验证截图');
 await page.getByRole('button',{name:'预览草稿',exact:true}).click();
 await expect(page.locator('.editor-preview .inline-reader-icon')).toBeVisible();
 await expect(page.locator('.editor-preview .inline-reader-math')).toBeVisible();
 await expect(page.locator('.editor-preview .inline-reader-image')).toHaveAttribute('alt','验证截图');
 await page.reload();await expect(page.locator('.editor-canvas .inline-reader-icon svg')).toBeVisible();
 await expect(page.locator('.editor-canvas .inline-reader-math math')).toBeVisible();
 await expect(page.locator('.editor-canvas .inline-reader-image')).toHaveAttribute('alt','验证截图');
 await page.evaluate(()=>document.documentElement.dataset.theme='dark');
 await expect(page.locator('.editor-canvas .bn-container')).toHaveAttribute('data-color-scheme','dark');
 await expect(page.locator('.editor-canvas .inline-reader-math math')).toBeVisible();
});
test('real BlockNote edits autosave reload and mixed blocks preview in order',async({page},info)=>{
 let saved=structuredClone(editorFixture);let writes=0;
 await page.route('**/api/admin/editor/*',async route=>{const value=route.request().postDataJSON();expect(value.expectedSequence).toBe(saved.sequence);saved={...saved,...value,sequence:saved.sequence+1};writes++;await route.fulfill({json:saved});});
 await mount(page,()=>saved);await typeText(page,' 中文更新');await expect(page.locator('.save-state')).toContainText('所有修改已保存',{timeout:8000});expect(writes).toBeGreaterThan(0);
 await slash(page,'提示框');const fields=page.locator('.editor-embedded').last();await fields.getByText('编辑此内容块',{exact:true}).click();await fields.locator('textarea').fill('核对二审');await expect(page.locator('.save-state')).toContainText('所有修改已保存',{timeout:8000});
 await page.getByRole('button',{name:'预览草稿',exact:true}).click();await expect(page.locator('.editor-preview')).toContainText('中文更新');await expect(page.locator('.editor-preview')).toContainText('核对二审');
 await page.reload();await expect(page.locator('.bn-editor')).toContainText('中文更新');await expect(page.locator('.editor-embedded')).toHaveCount(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`output/verification/editor-${info.project.name}.png`,fullPage:true});await page.evaluate(()=>document.documentElement.dataset.theme='dark');await page.locator('.editor-canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`output/verification/editor-dark-${info.project.name}.png`,fullPage:false});
});
test('hint can add a nested editable paragraph that survives autosave and preview',async({page})=>{
 let saved=structuredClone(editorFixture);
 await page.route('**/api/admin/editor/*',route=>{const value=route.request().postDataJSON();saved={...saved,...value,sequence:saved.sequence+1};return route.fulfill({json:saved});});
 await mount(page,()=>saved);
 await slash(page,'提示框');
 const hint=page.locator('.editor-embedded').last();
 await hint.getByText('编辑此内容块',{exact:true}).click();
 await hint.getByRole('combobox',{name:'提示图标'}).selectOption('shield');
 await hint.getByRole('button',{name:'在提示框中添加段落'}).click();
 const nested=hint.locator('xpath=ancestor::div[@data-node-type="blockContainer"][1]').locator('.bn-block-group .bn-inline-content').last();
 await nested.click();await page.keyboard.insertText('先核实员工身份');
 await expect.poll(()=>saved.body.startsWith('JUYU_BLOCKNOTE_V1\n')&&JSON.parse(saved.body.split('\n').slice(1).join('\n')).some((block:{type:string;children:{content:{text:string}[]}[]})=>block.type==='juyu'&&block.children.some(child=>child.content.some(text=>text.text==='先核实员工身份'))),{timeout:8000}).toBe(true);
 expect(JSON.parse(JSON.parse(saved.body.split('\n').slice(1).join('\n')).find((block:{type:string})=>block.type==='juyu').props.payload).iconKey).toBe('shield');
 await page.getByRole('button',{name:'预览草稿',exact:true}).click();
 await expect(page.locator('.editor-preview .rich-hint')).toContainText('先核实员工身份');
 await page.screenshot({path:`output/verification/rich-hint-nested-${test.info().project.name}.png`,fullPage:true});
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
 await mount(page,()=>saved);await slash(page,'代码块');await page.locator('[data-content-type="codeBlock"] select').selectOption('python');await page.locator('[data-content-type="codeBlock"] pre').click();await page.keyboard.insertText('print("保留代码")');await expect(page.locator('[data-content-type="codeBlock"] code [style*="--shiki"]')).not.toHaveCount(0);await expect(page.locator('.save-state')).toContainText('所有修改已保存',{timeout:8000});await page.reload();await expect(page.locator('[data-content-type="codeBlock"] code')).toHaveText('print("保留代码")');
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
 await page.getByText('当前输入备份',{exact:true}).click();await page.evaluate(()=>Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:()=>Promise.reject(new Error('denied'))}));await page.getByRole('button',{name:'复制这份备份'}).click();await expect(page.getByText('复制未成功，请选中上方文字手动复制。')).toBeVisible();await expect(page.getByLabel('当前输入备份',{exact:true})).toContainText('不可丢失');
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
 await expect(page.getByRole('dialog',{name:'阅读范围与资料',exact:true}).getByRole('textbox',{name:'问答分类',exact:true})).toHaveAttribute('maxlength','80');await page.getByRole('dialog',{name:'阅读范围与资料',exact:true}).getByRole('textbox',{name:'问答分类',exact:true}).fill('账户问题');await page.getByLabel('问答排序',{exact:true}).fill('12');await closeSettings(page);await page.getByRole('textbox',{name:/^(文章标题|问题)$/}).fill('如何核对账户？');
 await expect(page.locator('.save-state')).toContainText('所有修改已保存',{timeout:8000});expect(saved).toMatchObject({kind:'qa',qa:{category:'账户问题',position:12}});
 await page.reload();await settings(page,'阅读范围与资料');await expect(page.getByRole('dialog',{name:'阅读范围与资料',exact:true}).getByRole('textbox',{name:'问答分类',exact:true})).toHaveValue('账户问题');await expect(page.getByLabel('问答排序',{exact:true})).toHaveValue('12');
 await page.getByLabel('问答排序',{exact:true}).fill('-1');await closeSettings(page);await expect(page.getByRole('alert')).toContainText('问答排序须为');await settings(page);await expect(page.getByRole('button',{name:'立即保存',exact:true})).toBeDisabled();await closeSettings(page);await settings(page,'阅读范围与资料');
 await page.getByLabel('问答排序',{exact:true}).fill('5');await closeSettings(page);await expect(page.locator('.save-state')).toContainText('所有修改已保存',{timeout:8000});expect(saved).toMatchObject({qa:{category:'账户问题',position:5}});
 await page.screenshot({path:`output/verification/qa-editor-${info.project.name}.png`,fullPage:true});
});
test('Q&A classification freezes in review and the shortcut never changes an existing kind',async({page})=>{
 await mount(page,()=>({...editorFixture,kind:'qa',qa:{category:'既有分类',position:4},status:'in_review'}),'qa');await expect(page.getByRole('textbox',{name:'问答分类',exact:true})).toBeDisabled();await settings(page,'阅读范围与资料');await expect(page.getByLabel('问答排序',{exact:true})).toBeDisabled();await closeSettings(page);
 await page.unrouteAll();await mount(page,()=>editorFixture,'qa');await settings(page,'阅读范围与资料');await expect(page.getByRole('combobox',{name:'资料类型',exact:true})).toHaveValue('article');await expect(page.getByRole('textbox',{name:'问答分类',exact:true})).toHaveCount(0);
});

test('Q&A recovery keeps classification input and displays the server version before explicit replacement',async({page})=>{
 const initial:EditorData={...editorFixture,kind:'qa',qa:{category:'原分类',position:1}};const latest:EditorData={...initial,sequence:4,qa:{category:'服务器分类',position:6}};
 await page.route('**/api/admin/editor/*',r=>r.request().method()==='GET'?r.fulfill({json:latest}):r.fulfill({status:409,json:{error:'CONFLICT'}}));await mount(page,()=>initial);
 await page.getByRole('textbox',{name:'问答分类',exact:true}).fill('本地分类');await expect(page.getByRole('region',{name:'保存恢复'})).toBeVisible();await page.getByRole('button',{name:'读取服务器最新版本'}).click();await expect(page.getByRole('region',{name:'服务器版本'})).toContainText('服务器分类');await expect(page.getByRole('textbox',{name:'问答分类',exact:true})).toHaveValue('本地分类');
 await page.getByRole('button',{name:'保留备份并载入此版本'}).click();await page.getByRole('dialog').getByRole('button',{name:'确认继续',exact:true}).click();await expect(page.getByRole('textbox',{name:'问答分类',exact:true})).toHaveValue('服务器分类');await settings(page,'阅读范围与资料');await expect(page.getByLabel('问答排序',{exact:true})).toHaveValue('6');await closeSettings(page);await page.getByText('载入前的输入备份 1',{exact:true}).click();await expect(page.getByLabel('载入前的输入备份 1',{exact:true})).toContainText('本地分类');
});

test('Q&A mismatched save metadata is not acknowledged and exact retry preserves the submitted values',async({page})=>{
 const initial:EditorData={...editorFixture,kind:'qa',qa:{category:'原分类',position:1}};const writes:Record<string,unknown>[]=[];
 await page.route('**/api/admin/editor/*',r=>{const v=r.request().postDataJSON();writes.push(v);return r.fulfill({json:{...initial,...v,sequence:4,qa:writes.length===1?{category:'错误回执',position:99}:v.qa}});});await mount(page,()=>initial);
 await page.getByRole('textbox',{name:'问答分类',exact:true}).fill('新的分类');await expect(page.getByRole('status')).toContainText('保存尚未确认',{timeout:8000});expect(writes).toHaveLength(1);await expect(page.getByRole('textbox',{name:'问答分类',exact:true})).toHaveValue('新的分类');await page.getByRole('button',{name:'重试保存',exact:true}).click();await expect(page.locator('.save-state')).toContainText('所有修改已保存');expect(writes).toHaveLength(2);expect(writes[1]).toEqual(writes[0]);expect(writes[1].qa).toEqual({category:'新的分类',position:1});
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

test('native slash menu and selection toolbar expose original block and formatting controls',async({page})=>{
 await page.route('**/api/admin/editor/*',route=>route.fulfill({json:{...editorFixture,...route.request().postDataJSON(),sequence:4}}));
 await mount(page,()=>editorFixture);const editor=page.locator('.bn-editor');await editor.click();await page.keyboard.press('ControlOrMeta+End');await page.keyboard.press('Enter');await page.keyboard.type('/');
 const menu=page.locator('.bn-suggestion-menu');await expect(menu).toBeVisible();await expect(menu).toContainText('检查清单');await expect(menu).toContainText('引用');await expect(menu).toContainText('音频');await expect(menu).toContainText('表格');
 await page.keyboard.press('Escape');await page.keyboard.press('Backspace');await page.keyboard.insertText('选择文字显示完整工具栏');await page.keyboard.press('Shift+Home');
 await expect(page.locator('.bn-formatting-toolbar')).toBeVisible();await expect(page.locator('.bn-formatting-toolbar button')).not.toHaveCount(6);
 await page.keyboard.press('ArrowRight');await expect(page.locator('.bn-formatting-toolbar')).toBeHidden();
 await editor.locator('[data-content-type="paragraph"]').last().hover();await expect(page.locator('.bn-side-menu')).toBeVisible();
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

test('R19 opt-in copy survives reload and restore waits for explicit save',async({page},info)=>{
 let writes=0;await page.route('**/api/admin/editor/*',r=>{if(r.request().method()==='GET')return r.fulfill({json:editorFixture});writes++;return r.fulfill({status:503,json:{error:'UNAVAILABLE'}});});
 await mount(page,()=>editorFixture);await page.getByText('本机草稿恢复',{exact:true}).click();await page.getByRole('button',{name:'在此设备开启恢复'}).click();
 await typeText(page,' 需要恢复的红字内容');await expect.poll(()=>page.evaluate(()=>Object.values(localStorage).some(v=>v.includes('需要恢复的红字内容')))).toBe(true);
 page.on('dialog',d=>d.accept());await page.reload();await expect(page.getByRole('region',{name:'可恢复输入'})).toBeVisible();await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`output/verification/R19-recovery-${info.project.name}.png`,fullPage:true});
 await page.getByRole('button',{name:'恢复到编辑区'}).click();await page.getByRole('button',{name:'确认继续',exact:true}).click();
 await expect(page.locator('.bn-editor')).toContainText('需要恢复的红字内容');await expect(page.getByText('已恢复输入，自动保存已暂停。请核对后点击立即保存。')).toBeVisible();
 const before=writes;await page.waitForTimeout(1500);expect(writes).toBe(before);
 await page.getByText('本机草稿恢复 · 已开启',{exact:true}).click();await page.getByRole('button',{name:'关闭并清除本机副本'}).click();await page.getByRole('button',{name:'确认继续',exact:true}).click();
 expect(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('juyu:editor-recovery:')))).toEqual([]);
});
test('R19 changed server version retains copy without replacing editor',async({page})=>{
 await page.route('**/api/admin/editor/*',r=>r.request().method()==='GET'?r.fulfill({json:{...editorFixture,sequence:9}}):r.fulfill({status:503,json:{error:'UNAVAILABLE'}}));
 await mount(page,()=>editorFixture);await page.getByText('本机草稿恢复',{exact:true}).click();await page.getByRole('button',{name:'在此设备开启恢复'}).click();await typeText(page,' 不要覆盖最新版本');
 await expect.poll(()=>page.evaluate(()=>Object.values(localStorage).some(v=>v.includes('不要覆盖最新版本')))).toBe(true);page.on('dialog',d=>d.accept());await page.reload();
 await page.getByRole('button',{name:'恢复到编辑区'}).click();await page.getByRole('button',{name:'确认继续',exact:true}).click();
 await expect(page.getByText('无法安全恢复：服务器版本或权限可能已变化。副本仍保留，请复制后与最新文章对照。')).toBeVisible();
 await expect(page.locator('.bn-editor')).not.toContainText('不要覆盖最新版本');await expect(page.getByLabel('本机恢复副本')).toContainText('不要覆盖最新版本');
});

test('R19 unsaved new article reopens its original recovery identity',async({page})=>{
 await page.route('**/api/admin/editor/*',r=>r.fulfill({status:404,json:{error:'NOT_FOUND'}}));await mount(page,()=>null);
 await page.getByText('本机草稿恢复',{exact:true}).click();await page.getByRole('button',{name:'在此设备开启恢复'}).click();await typeText(page,' 尚未命名的新文章');
 await expect.poll(()=>page.evaluate(()=>Object.values(localStorage).some(v=>v.includes('尚未命名的新文章')))).toBe(true);
 page.on('dialog',d=>d.accept());await page.reload();await page.getByRole('button',{name:'恢复到编辑区'}).click();await page.getByRole('button',{name:'确认继续',exact:true}).click();await expect(page.locator('.bn-editor')).toContainText('尚未命名的新文章');
});

test('invalid file format is an error notification regardless of Chinese wording',async({page})=>{
 await mount(page,()=>editorFixture);await settings(page,'封面与附件');await page.getByLabel('上传文件',{exact:true}).setInputFiles({name:'bad.exe',mimeType:'application/octet-stream',buffer:Buffer.from('invalid')});
 await expect(page.locator('.juyu-toast.error')).toContainText('文件格式或大小不符合要求');await expect(page.locator('.juyu-toast.success')).toHaveCount(0);
});
