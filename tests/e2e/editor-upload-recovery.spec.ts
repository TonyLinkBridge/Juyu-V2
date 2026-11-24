import {readFile} from 'node:fs/promises';
import {test,expect,type Page} from '@playwright/test';
import {editorBrowserBundle,editorFixture} from '../helpers/editor-browser';
import type {EditorData} from '../../src/editor/contract';
import {encodeEditorBody} from '../../src/editor/document';
let bundle:Awaited<ReturnType<typeof editorBrowserBundle>>;
test.beforeAll(async()=>{bundle=await editorBrowserBundle();});
async function mount(page:Page,initial:()=>EditorData|null,newReference:boolean|'qa'=false){
 await page.route('**/__editor_assets/*.js',async route=>{const file=new URL(route.request().url()).pathname.split('/').pop()!;if(!/^[a-zA-Z0-9_.-]+\.js$/.test(file))return route.abort();return route.fulfill({contentType:'application/javascript',body:await readFile('output/verification/editor-fixture/'+file,'utf8')});});
 await page.route(url=>url.pathname==='/__editor_fixture'||url.pathname==='/admin/editor',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.css}</style></head><body><main class="editor-main"><h1>文章编辑 · 本地样例</h1><script type="application/json" id="data">${JSON.stringify(initial()).replace(/</g,'\\u003c')}</script><div id="editor"></div><a href="/leaving">离开编辑页</a></main><script>${bundle.script.replace(/<\/script/gi,'<\\/script')}</script></body></html>`}));
 await page.goto('/__editor_fixture'+(newReference==='qa'?'?kind=qa':newReference?'?kind=reference':''));await expect(page.locator('.bn-editor')).toBeVisible();
}
const asset='12345678-1234-4234-8234-123456789abc';
async function pasteImage(page:Page){
 const bytes=[...await readFile('tests/fixtures/article-cover.png')];
 await page.locator('.bn-editor[contenteditable="true"]').click();
 await page.locator('.bn-editor[contenteditable="true"]').evaluate((element,bytes)=>{const clipboardData=new DataTransfer();clipboardData.items.add(new File([new Uint8Array(bytes)],'screenshot.png',{type:'image/png'}));element.dispatchEvent(new ClipboardEvent('paste',{clipboardData,bubbles:true,cancelable:true}));},bytes);
}
async function saveRoute(page:Page,initial=structuredClone(editorFixture)){
 let saved=initial;await page.route('**/api/admin/editor/*',route=>{saved={...saved,...route.request().postDataJSON(),sequence:saved.sequence+1};return route.fulfill({json:saved});});return ()=>saved;
}
test('failed pasted image stops loading and can retry the same block without losing text',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const saved=await saveRoute(page);let requests=0;
 await page.route('**/api/admin/media/*/upload',route=>++requests===1?route.fulfill({status:503,json:{error:'MEDIA_UNAVAILABLE'}}):route.fulfill({json:{id:asset,filename:'screenshot.png',mime:'image/png',size:'100',status:'ready'}}));
 await page.route('**/api/admin/assets/*',route=>route.fulfill({path:'tests/fixtures/article-cover.png',contentType:'image/png'}));
 await mount(page,saved);await pasteImage(page);
 const issues=page.getByRole('region',{name:'上传失败的文件'});await expect(issues).toContainText('screenshot.png');
 await expect(page.locator('.bn-file-loading-preview')).toHaveCount(0);
 await expect(page.locator('.save-state')).toContainText('上传失败');
 await expect(page.getByRole('button',{name:'提交二审',exact:true})).toBeDisabled();
 const blockId=await page.locator('[data-content-type="image"]').evaluate(element=>element.closest('[data-id]')?.getAttribute('data-id'));
 await issues.getByRole('button',{name:'重试上传',exact:true}).click();
 await expect(page.locator('.bn-editor img')).toHaveAttribute('src','/api/admin/assets/'+asset);
 await expect(page.locator('[data-content-type="image"]')).toHaveCount(1);
 expect(await page.locator('[data-content-type="image"]').evaluate(element=>element.closest('[data-id]')?.getAttribute('data-id'))).toBe(blockId);
 await expect(page.locator('.save-state')).toContainText('所有修改已保存');
 expect(saved().body).toContain('原始正文');expect(saved().body).toContain('/api/assets/'+asset);expect(errors).toEqual([]);expect(requests).toBe(2);
 await page.screenshot({path:'output/verification/upload-retry-success.png',fullPage:true});
});
test('deleting a failed upload removes only its empty placeholder',async({page})=>{
 const saved=await saveRoute(page);await page.route('**/api/admin/media/*/upload',route=>route.fulfill({status:413,json:{error:'UPLOAD_TOO_LARGE'}}));
 await mount(page,saved);await pasteImage(page);const issues=page.getByRole('region',{name:'上传失败的文件'});
 await expect(issues).toBeVisible();await expect(page.locator('.bn-file-loading-preview')).toHaveCount(0);
 await page.screenshot({path:'output/verification/upload-failure-actions.png',fullPage:true});
 await issues.getByRole('button',{name:'删除占位',exact:true}).click();
 await expect(page.locator('[data-content-type="image"]')).toHaveCount(0);await expect(issues).toHaveCount(0);
 await expect(page.locator('.bn-editor')).toContainText('原始正文');await expect(page.locator('.save-state')).toContainText('所有修改已保存');
 expect(saved().body).toContain('原始正文');expect(saved().body).not.toContain('screenshot.png');
});
for(const type of ['image','video','audio','file'] as const)test(`${type} chooser failure recovers and has retry/delete controls`,async({page})=>{
 const initial={...structuredClone(editorFixture),body:encodeEditorBody([{id:'upload-block',type,props:{url:'',name:''},children:[]}])};
 const saved=await saveRoute(page,initial);await page.route('**/api/admin/media/*/upload',route=>route.fulfill({status:503,json:{error:'MEDIA_UNAVAILABLE'}}));
 await mount(page,saved);await page.locator('.bn-add-file-button').click();
 await page.getByRole('tabpanel',{name:'上传',exact:true}).locator('input[type=file]').setInputFiles({name:type==='image'?'picture.png':type==='video'?'video.mp4':type==='audio'?'audio.mp3':'file.pdf',mimeType:type==='image'?'image/png':type==='video'?'video/mp4':type==='audio'?'audio/mpeg':'application/pdf',buffer:Buffer.from('fixture')});
 const issues=page.getByRole('region',{name:'上传失败的文件'});await expect(issues).toBeVisible();
 await expect(page.locator('.bn-file-loading-preview')).toHaveCount(0);await expect(issues.getByRole('button',{name:'重试上传',exact:true})).toBeEnabled();await expect(issues.getByRole('button',{name:'删除占位',exact:true})).toBeEnabled();
});
test('toolbar save and clipboard hint are visible, and save preserves the draft',async({page})=>{
 const saved=await saveRoute(page);await mount(page,saved);
 const save=page.locator('.editor-toolbar').getByRole('button',{name:'保存草稿',exact:true});await expect(save).toBeVisible();await expect(save).toBeDisabled();
 await expect(page.getByText('支持直接粘贴截图或图片（Ctrl+V / ⌘V），也可以拖入文件。',{exact:true})).toBeVisible();
 await page.getByRole('textbox',{name:'文章标题'}).fill('手动保存测试');await expect(save).toBeEnabled();await save.click();
 await expect(page.locator('.save-state')).toContainText('所有修改已保存');expect(saved().title).toBe('手动保存测试');expect(saved().body).toContain('原始正文');
});
test('locked review versions cannot be saved or upload files',async({page})=>{
 await mount(page,()=>({...structuredClone(editorFixture),status:'in_review'}));
 await expect(page.locator('.editor-toolbar').getByRole('button',{name:'保存草稿',exact:true})).toBeDisabled();
 await expect(page.locator('.bn-editor')).toHaveAttribute('contenteditable','false');
});
for(const kind of ['article','ops','reference','qa'] as const)test(`${kind} saves a working edit without changing its published revision`,async({page})=>{
 const saved=await saveRoute(page,{...structuredClone(editorFixture),kind,publishedRevision:2,publicationNumber:2});
 await mount(page,saved);const label=kind==='qa'?'问题':'文章标题';await page.getByRole('textbox',{name:label,exact:true}).fill('只修改测试草稿');
 await page.locator('.editor-toolbar').getByRole('button',{name:'保存草稿',exact:true}).click();
 await expect(page.locator('.save-state')).toContainText('所有修改已保存');expect(saved().publishedRevision).toBe(2);expect(saved().kind).toBe(kind);expect(saved().body).toContain('原始正文');
});
test('English editor exposes English upload recovery and save actions',async({page})=>{
 const saved=await saveRoute(page,{...structuredClone(editorFixture),locale:'en',translationOf:'11111111-1111-4111-8111-111111111111'});
 await page.route('**/api/admin/media/*/upload',route=>route.fulfill({status:503,json:{error:'MEDIA_UNAVAILABLE'}}));
 await mount(page,saved);await expect(page.locator('.editor-toolbar').getByRole('button',{name:'Save draft',exact:true})).toBeVisible();await pasteImage(page);
 const issues=page.getByRole('region',{name:'Failed uploads'});await expect(issues.getByRole('button',{name:'Retry upload',exact:true})).toBeVisible();await expect(issues.getByRole('button',{name:'Remove placeholder',exact:true})).toBeVisible();await expect(page.locator('.bn-file-loading-preview')).toHaveCount(0);
});
test('a new unsaved article can retry the pasted image after its first draft save',async({page})=>{
 let saved:EditorData|null=null;let uploads=0;const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/admin/editor/*',route=>{const payload=route.request().postDataJSON();saved={...structuredClone(editorFixture),...payload,documentId:new URL(route.request().url()).pathname.split('/').pop()!,sequence:saved?saved.sequence+1:0};return route.fulfill({json:saved});});
 await page.route('**/api/admin/media/*/upload',route=>{uploads++;return route.fulfill({json:{id:asset,filename:'screenshot.png',mime:'image/png',size:'100',status:'ready'}});});
 await page.route('**/api/admin/assets/*',route=>route.fulfill({path:'tests/fixtures/article-cover.png',contentType:'image/png'}));
 await mount(page,()=>null);await pasteImage(page);const issues=page.getByRole('region',{name:'上传失败的文件'});await expect(issues).toContainText('请先填写标题并保存草稿');expect(uploads).toBe(0);
 await page.getByRole('textbox',{name:'文章标题',exact:true}).fill('先保存再重试');await page.locator('.editor-toolbar').getByRole('button',{name:'保存草稿',exact:true}).click();
 await expect.poll(()=>saved!==null).toBe(true);await issues.getByRole('button',{name:'重试上传',exact:true}).click();await expect(page.locator('.bn-editor img')).toHaveAttribute('src','/api/admin/assets/'+asset);await expect(page.locator('.save-state')).toContainText('所有修改已保存');expect(errors).toEqual([]);expect(uploads).toBe(1);
});
test('discarding a failed media parent preserves its nested paragraphs',async({page})=>{
 const saved=await saveRoute(page,{...structuredClone(editorFixture),body:encodeEditorBody([{id:'parent-image',type:'image',props:{url:'',name:''},children:[{id:'keep-child',type:'paragraph',content:[{type:'text',text:'嵌套正文不能删除',styles:{}}],children:[]}]}])});
 await page.route('**/api/admin/media/*/upload',route=>route.fulfill({status:503,json:{error:'MEDIA_UNAVAILABLE'}}));
 await mount(page,saved);await page.locator('.bn-add-file-button').click();await page.getByRole('tabpanel',{name:'上传',exact:true}).locator('input[type=file]').setInputFiles({name:'file.png',mimeType:'image/png',buffer:Buffer.from('fixture')});
 await page.getByRole('region',{name:'上传失败的文件'}).getByRole('button',{name:'删除占位',exact:true}).click();
 await expect(page.locator('.bn-editor')).toContainText('嵌套正文不能删除');await expect(page.locator('.save-state')).toContainText('所有修改已保存');expect(saved().body).toContain('keep-child');
});
test('retrying a chosen attachment preserves its filename',async({page})=>{
 const saved=await saveRoute(page,{...structuredClone(editorFixture),body:encodeEditorBody([{id:'file-block',type:'file',props:{url:'',name:''},children:[]}])});let requests=0;
 await page.route('**/api/admin/media/*/upload',route=>++requests===1?route.fulfill({status:503,json:{error:'MEDIA_UNAVAILABLE'}}):route.fulfill({json:{id:asset,filename:'report.pdf',mime:'application/pdf',size:'100',status:'ready'}}));
 await mount(page,saved);await page.locator('.bn-add-file-button').click();await page.getByRole('tabpanel',{name:'上传',exact:true}).locator('input[type=file]').setInputFiles({name:'report.pdf',mimeType:'application/pdf',buffer:Buffer.from('fixture')});
 await page.getByRole('region',{name:'上传失败的文件'}).getByRole('button',{name:'重试上传',exact:true}).click();
 await expect(page.locator('.bn-editor')).toContainText('report.pdf');await expect(page.locator('.save-state')).toContainText('所有修改已保存');expect(saved().body).toContain('report.pdf');
});
for(const outcome of ['success','failure'])test(`deleting an in-flight paste block handles upload ${outcome} without an unhandled error`,async({page})=>{
 const saved=await saveRoute(page);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});let started=false;
 await page.route('**/api/admin/media/*/upload',async route=>{started=true;await held;return outcome==='success'?route.fulfill({json:{id:asset,filename:'screenshot.png',mime:'image/png',size:'100',status:'ready'}}):route.fulfill({status:503,json:{error:'MEDIA_UNAVAILABLE'}});});
 await mount(page,saved);await pasteImage(page);await expect.poll(()=>started).toBe(true);
 // Native side-menu deletion while the upload request is still pending.
 await page.locator('[data-content-type="image"]').hover();await page.locator('.bn-side-menu [draggable="true"]').click();await page.getByRole('menuitem',{name:'删除',exact:true}).click();
 await expect(page.locator('[data-content-type="image"]')).toHaveCount(0);release();
 await expect(page.locator('.save-state')).toContainText('所有修改已保存');await expect(page.getByRole('region',{name:'上传失败的文件'})).toHaveCount(0);expect(errors).toEqual([]);expect(saved().body).toContain('原始正文');
});
test('mobile upload recovery and save controls fit the screen',async({page})=>{
 await page.setViewportSize({width:390,height:844});const saved=await saveRoute(page);await page.route('**/api/admin/media/*/upload',route=>route.fulfill({status:503,json:{error:'MEDIA_UNAVAILABLE'}}));
 await mount(page,saved);await pasteImage(page);const issues=page.getByRole('region',{name:'上传失败的文件'});await expect(issues.getByRole('button',{name:'重试上传',exact:true})).toBeVisible();await expect(page.locator('.editor-toolbar').getByRole('button',{name:'保存草稿',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'output/verification/upload-recovery-mobile.png',fullPage:true});
});
test('removing the first pending file does not interrupt a multi-image paste',async({page})=>{
 const saved=await saveRoute(page);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});let requests=0;
 await page.route('**/api/admin/media/*/upload',async route=>{requests++;if(requests===1){await held;return route.fulfill({status:503,json:{error:'MEDIA_UNAVAILABLE'}});}return route.fulfill({json:{id:asset,filename:'second.png',mime:'image/png',size:'100',status:'ready'}});});
 await page.route('**/api/admin/assets/*',route=>route.fulfill({path:'tests/fixtures/article-cover.png',contentType:'image/png'}));await mount(page,saved);
 const bytes=[...await readFile('tests/fixtures/article-cover.png')];await page.locator('.bn-editor').click();await page.locator('.bn-editor').evaluate((element,bytes)=>{const clipboardData=new DataTransfer();for(const name of ['first.png','second.png'])clipboardData.items.add(new File([new Uint8Array(bytes)],name,{type:'image/png'}));element.dispatchEvent(new ClipboardEvent('paste',{clipboardData,bubbles:true,cancelable:true}));},bytes);
 await expect.poll(()=>requests).toBe(1);await page.locator('[data-content-type="image"]').hover();await page.locator('.bn-side-menu [draggable="true"]').click();await page.getByRole('menuitem',{name:'删除',exact:true}).click();release();
 await expect(page.locator('.bn-editor img')).toHaveAttribute('src','/api/admin/assets/'+asset);await expect(page.locator('.save-state')).toContainText('所有修改已保存');expect(requests).toBe(2);expect(saved().body).toContain('second.png');expect(saved().body).toContain('原始正文');expect(errors).toEqual([]);
});
test('mixed HTML and image clipboard preserves the rich text paste',async({page})=>{
 const saved=await saveRoute(page);let uploads=0;await page.route('**/api/admin/media/*/upload',route=>{uploads++;return route.fulfill({status:503,json:{error:'MEDIA_UNAVAILABLE'}});});await mount(page,saved);
 const bytes=[...await readFile('tests/fixtures/article-cover.png')];await page.locator('.bn-editor').click();await page.locator('.bn-editor').evaluate((element,bytes)=>{const clipboardData=new DataTransfer();clipboardData.setData('text/html','<p><strong>复制的富文本必须保留</strong></p>');clipboardData.setData('text/plain','复制的富文本必须保留');clipboardData.items.add(new File([new Uint8Array(bytes)],'image.png',{type:'image/png'}));element.dispatchEvent(new ClipboardEvent('paste',{clipboardData,bubbles:true,cancelable:true}));},bytes);
 await expect(page.locator('.bn-editor strong')).toContainText('复制的富文本必须保留');await expect(page.locator('.save-state')).toContainText('所有修改已保存');expect(uploads).toBe(0);expect(saved().body).toContain('复制的富文本必须保留');
});
