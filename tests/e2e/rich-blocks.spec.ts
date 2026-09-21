import {fixtureAssets} from '../helpers/fixture-assets';
import {test,expect,type Page} from '@playwright/test';
import {navigationBrowserBundle} from '../helpers/navigation-browser';
import type {MediaEditorData} from '../../src/media/editor';
import type {MediaBlock} from '../../src/media/model';
import {encodeTabBody} from '../../src/media/tab-body';
import {inlineEmbedHref} from '../../src/editor/inline-embed';
import {encodeEditorBody,editorMedia,decodeEditorBody} from '../../src/editor/document';
let bundle:Awaited<ReturnType<typeof navigationBrowserBundle>>;
const code='<script>window.richInjected=true</script>\n  const 中文 = "保留缩进";\n\t下一行\n';
const blocks:MediaBlock[]=[{id:'hint',type:'hint',style:'warning',title:'执行前核对',body:'先确认身份\n再检查费用。'},{id:'code',type:'code',language:'html',code},{id:'tabs',type:'tabs',tabs:[{id:'one',title:'注册',body:'注册操作内容'},{id:'two',title:'转入',body:'转入操作内容'},{id:'three',title:'异常',body:'异常升级内容'}]}];
const initial:MediaEditorData={documentId:'rich-test',title:'内容块 · 本地示例',body:'基础正文',sequence:0,status:'draft',lifecycle:'active',blocks:[],cover:null,tags:[],assets:[]};
test.beforeEach(async({page})=>{await fixtureAssets(page,'navigation');});
test.beforeAll(async()=>{bundle=await navigationBrowserBundle();});
function html(data:unknown){return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.css}</style></head><body><div id="presentation"></div><script id="data" type="application/json">${JSON.stringify(data).replace(/</g,'\\u003c')}</script><script>${bundle.script}</script></body></html>`;}
async function editor(page:Page){let state=structuredClone(initial);const bodies:Record<string,unknown>[]=[];
 await page.route(url=>url.pathname==='/admin/media',route=>route.fulfill({contentType:'text/html',body:html({mediaEditor:state})}));
 await page.route('**/api/admin/media/rich-test',route=>{const body=route.request().postDataJSON();bodies.push(body);state={...state,blocks:body.blocks,cover:body.cover,sequence:state.sequence+1};return route.fulfill({json:state});});await page.goto('/admin/media?article=rich-test');return bodies;
}
async function reader(page:Page,content=blocks){await page.route(url=>url.pathname==='/help-centre',route=>route.fulfill({contentType:'text/html',body:html({pages:[{type:'document',id:'rich-test',title:'提示、代码和标签 · 本地示例',href:'/help-centre?article=rich-test'}],requested:'rich-test',article:{id:'rich-test',title:'提示、代码和标签 · 本地示例',revision:1,body:'员工正式阅读示例',blocks:content}})}));await page.route('**/api/articles/rich-test/feedback?**',route=>route.fulfill({json:{feedback:null}}));await page.goto('/help-centre');}
test('reader can view and copy the authorized article as Markdown',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);await reader(page);
 await page.getByRole('button',{name:'查看 Markdown'}).click();
 const dialog=page.getByRole('dialog',{name:'文章 Markdown'});
 await expect(dialog.getByRole('textbox',{name:'文章 Markdown 内容'})).toContainText('# 提示、代码和标签');
 await expect(dialog.getByRole('textbox',{name:'文章 Markdown 内容'})).toContainText('员工正式阅读示例');
 await dialog.getByRole('button',{name:'复制全文'}).click();
 const copied=await page.evaluate(()=>navigator.clipboard.readText());expect(copied).toContain('# 提示、代码和标签');
 await dialog.getByRole('button',{name:'关闭',exact:true}).click();await expect(dialog).not.toBeVisible();
});
test('external embed waits for the reader click and keeps a safe original link',async({page})=>{
 let requests=0;
 await page.route('https://www.youtube-nocookie.com/**',route=>{requests++;return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Local video frame</title>'});});
 await reader(page,[{id:'video',type:'externalEmbed',url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',caption:'操作说明'}]);
 const embed=page.locator('.reader-external-embed');await expect(embed).toContainText('YouTube 内容');expect(requests).toBe(0);
 await expect(embed.locator('iframe')).toHaveCount(0);
 await expect(embed.getByRole('link',{name:'到 YouTube 打开'})).toHaveAttribute('href','https://www.youtube.com/watch?v=dQw4w9WgXcQ');
 await embed.getByRole('button',{name:'加载外部内容'}).click();
 await expect(embed.locator('iframe')).toHaveAttribute('src','https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
 await expect.poll(()=>requests).toBe(1);
});
test('unknown HTTPS source stays a link card and never creates a frame',async({page})=>{
 await reader(page,[{id:'guide',type:'externalEmbed',url:'https://example.com/guide',caption:'外部操作指南'}]);
 const embed=page.locator('.reader-external-embed');
 await expect(embed).toContainText('example.com');
 await expect(embed.locator('iframe')).toHaveCount(0);
 await expect(embed.getByRole('link',{name:'打开外部网站'})).toHaveAttribute('href','https://example.com/guide');
 await expect(embed).toContainText('外部操作指南');
});
test('editor saves an allowed external embed and keeps its caption after reload',async({page})=>{
 const bodies=await editor(page);
 await page.getByRole('button',{name:'新增外部内容'}).click();
 await page.getByRole('textbox',{name:'外部内容网址'}).fill('https://vimeo.com/123456789');
 await page.getByRole('textbox',{name:'外部内容说明'}).fill('操作影片');
 await expect(page.getByLabel('外部内容效果预览')).toContainText('Vimeo 内容');
 await expect(page.getByLabel('外部内容效果预览').locator('iframe')).toHaveCount(0);
 await page.getByRole('button',{name:'保存草稿',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'草稿已保存'})).toBeVisible();
 expect((bodies.at(-1)?.blocks as MediaBlock[]).find(block=>block.type==='externalEmbed')).toMatchObject({url:'https://vimeo.com/123456789',caption:'操作影片'});
 await page.reload();await expect(page.getByRole('textbox',{name:'外部内容说明'})).toHaveValue('操作影片');
});
test('published reader shows inline icon, formula and private image from the same saved body',async({page})=>{
 const assetId='00000000-0000-4000-8000-000000000081';
 const body=encodeEditorBody([{id:'inline',type:'paragraph',props:{textAlignment:'left',textColor:'default',backgroundColor:'default'},content:[
  {type:'text',text:'核对 ',styles:{}},
  {type:'link',href:inlineEmbedHref({type:'icon',icon:'shield'}),content:[{type:'text',text:'安全',styles:{}}]},
  {type:'link',href:inlineEmbedHref({type:'math',source:'x^2'}),content:[{type:'text',text:'公式',styles:{}}]},
  {type:'link',href:inlineEmbedHref({type:'image',assetId}),content:[{type:'text',text:'验证截图',styles:{}}]},
 ],children:[]}]);
 const pages=[{type:'document',id:'rich-test',title:'行内内容',href:'/help-centre?article=rich-test'}];
 await page.route(url=>url.pathname==='/help-centre',route=>route.fulfill({contentType:'text/html',body:html({pages,requested:'rich-test',article:{id:'rich-test',title:'行内内容',revision:1,body,blocks:editorMedia(decodeEditorBody(body)!)}})}));
 await page.goto('/help-centre');
 await expect(page.locator('.gitbook-document .inline-reader-icon')).toHaveAttribute('aria-label','安全');
 await expect(page.locator('.gitbook-document .inline-reader-math')).toHaveAttribute('aria-label','x^2');
 await expect(page.locator('.gitbook-document .inline-reader-image')).toHaveAttribute('src',`/api/assets/${assetId}`);
 await expect(page.locator('.gitbook-document .inline-reader-image')).toHaveAttribute('alt','验证截图');
});
test('article reference displays only an authorized target from the reader directory',async({page})=>{
 const reference:MediaBlock={id:'linked-guide',type:'articleReference',targetId:'target-guide'};
 const source={type:'document',id:'rich-test',title:'来源资料',href:'/help-centre?article=rich-test'};
 const target={type:'document',id:'target-guide',title:'已授权目标',description:'办理说明',href:'/help-centre?article=target-guide'};
 await page.route(url=>url.pathname==='/help-centre',route=>route.fulfill({contentType:'text/html',body:html({pages:[source,target],requested:'rich-test',article:{id:'rich-test',title:'来源资料',revision:1,body:'',blocks:[reference]}})}));
 await page.goto('/help-centre');
 const card=page.getByRole('link',{name:'阅读文章：已授权目标'});
 await expect(card).toHaveAttribute('href','/help-centre?article=target-guide');
 await expect(card).toContainText('办理说明');
 await page.unrouteAll({behavior:'wait'});
 await page.route(url=>url.pathname==='/help-centre',route=>route.fulfill({contentType:'text/html',body:html({pages:[source],requested:'rich-test',article:{id:'rich-test',title:'来源资料',revision:1,body:'',blocks:[reference]}})}));
 await page.reload();
 await expect(page.getByText('引用的资料目前无法阅读。')).toBeVisible();
 await expect(page.getByText('已授权目标')).toHaveCount(0);
 await expect(page.locator('.article-reference a')).toHaveCount(0);
});
test('editor finds a published article and saves its ID as a reference',async({page})=>{
 await page.route('**/api/admin/workspace?**',route=>route.fulfill({json:{items:[{id:'target-guide',title:'目标操作指南',kind:'article',publishedRevision:1}]}}));
 await page.route('**/api/admin/editor/target-guide',route=>route.fulfill({json:{id:'target-guide',title:'目标操作指南'}}));
 const bodies=await editor(page);
 await page.getByRole('button',{name:'新增文章引用'}).click();
 await page.getByRole('textbox',{name:'搜索引用文章'}).fill('目标');
 await page.getByRole('option',{name:'目标操作指南'}).click();
 await expect(page.getByText('当前引用：')).toContainText('目标操作指南');
 await page.getByRole('button',{name:'保存草稿',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'草稿已保存'})).toBeVisible();
 const saved=(bodies.at(-1)?.blocks as MediaBlock[]).find(block=>block.type==='articleReference');
 expect(saved).toEqual({id:expect.any(String),type:'articleReference',targetId:'target-guide'});
 await page.reload();
 await expect(page.getByText('当前引用：')).toContainText('目标操作指南');
});
test('an in-content button saves and opens a safe destination',async({page})=>{
 const bodies=await editor(page);
 await page.getByRole('button',{name:'新增操作按钮'}).click();
 await page.getByRole('textbox',{name:'按钮文字'}).fill('查看申请表');
 await page.getByRole('textbox',{name:'按钮跳转地址'}).fill('/help-centre/forms');
 await page.getByRole('button',{name:'保存草稿',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'草稿已保存'})).toBeVisible();
 const saved=(bodies.at(-1)?.blocks as MediaBlock[]).find(block=>block.type==='button');
 expect(saved).toMatchObject({label:'查看申请表',href:'/help-centre/forms',variant:'primary'});
 await page.reload();
 await expect(page.getByRole('textbox',{name:'按钮文字'})).toHaveValue('查看申请表');
 await reader(page,[saved!]);
 await expect(page.getByRole('link',{name:'查看申请表'})).toHaveAttribute('href','/help-centre/forms');
});
test('tabs provide a shareable deep link and restore the selected tab after navigation',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);
 await reader(page);
 const tabs=page.getByRole('region',{name:'分页内容'});
 await tabs.getByRole('tab',{name:'转入'}).click();
 await expect(tabs.getByRole('tab',{name:'转入'})).toHaveAttribute('aria-selected','true');
 expect(new URL(page.url()).searchParams.get('juyuTab')).toBe('转入');
 await tabs.getByRole('button',{name:'复制当前标签链接'}).click();
 await expect(tabs.getByRole('status')).toContainText('链接已复制');
 const copied=await page.evaluate(()=>navigator.clipboard.readText());
 expect(new URL(copied).searchParams.get('juyuTab')).toBe('转入');
 await page.goto(copied);
 await expect(tabs.getByRole('tab',{name:'转入'})).toHaveAttribute('aria-selected','true');
 await expect(tabs.getByText('转入操作内容')).toBeVisible();
});
test('ordered steps survive save and render with numbered content in the reader',async({page})=>{
 const bodies=await editor(page);
 await page.getByRole('button',{name:'新增操作步骤',exact:true}).click();
 await page.getByLabel('步骤 1 标题',{exact:true}).fill('核对身份');
 await page.getByLabel('步骤 1 内容',{exact:true}).fill('查看账号资料');
 await page.getByRole('button',{name:'增加步骤',exact:true}).click();
 await page.getByLabel('步骤 2 标题',{exact:true}).fill('提交工单');
 await page.getByLabel('步骤 2 内容',{exact:true}).fill('记录处理结果');
 await page.getByRole('button',{name:'保存草稿',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('草稿已保存');
 const saved=(bodies.at(-1)?.blocks as MediaBlock[]).find(block=>block.type==='steps')!;
 await page.reload();
 await expect(page.getByLabel('步骤 2 标题',{exact:true})).toHaveValue('提交工单');
 await reader(page,[saved]);
 const steps=page.getByRole('region',{name:'操作步骤'});
 await expect(steps.locator('li')).toHaveCount(2);
 await expect(steps.getByText('记录处理结果')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
test('columns save and stack vertically on a narrow reader',async({page})=>{
 const bodies=await editor(page);
 await page.getByRole('button',{name:'新增分栏布局',exact:true}).click();
 await page.getByLabel('第 1 栏标题',{exact:true}).fill('适用条件');
 await page.getByLabel('第 1 栏内容',{exact:true}).fill('先核对账户');
 await page.getByLabel('第 2 栏标题',{exact:true}).fill('办理方式');
 await page.getByLabel('第 2 栏内容',{exact:true}).fill('再提交申请');
 await page.getByRole('button',{name:'保存草稿',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('草稿已保存');
 const saved=(bodies.at(-1)?.blocks as MediaBlock[]).find(block=>block.type==='columns')!;
 await page.reload();await expect(page.getByLabel('第 2 栏标题',{exact:true})).toHaveValue('办理方式');
 await reader(page,[saved]);
 const columns=page.getByRole('region',{name:'分栏内容'});
 await expect(columns.locator('article')).toHaveCount(2);
 await expect(columns.getByText('再提交申请')).toBeVisible();
 await page.setViewportSize({width:390,height:760});
 expect(await columns.evaluate(element=>getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
test('a private screenshot in the right column renders through the protected asset route',async({page})=>{
 const imageId='00000000-0000-4000-8000-000000000041';
 const body=encodeTabBody([{id:'screenshot',type:'image',props:{url:`/api/assets/${imageId}`,name:'操作截图'},children:[]}]);
 const columns:Extract<MediaBlock,{type:'columns'}>={id:'picture-columns',type:'columns',columns:[{id:'left',title:'操作说明',body:'先完成验证'},{id:'right',title:'操作截图',body}]};
 await page.route(`**/api/assets/${imageId}`,route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jvJ0AAAAASUVORK5CYII=','base64')}));
 await reader(page,[columns]);
 const image=page.getByRole('region',{name:'分栏内容'}).getByRole('img',{name:'操作截图'});
 await expect(image).toBeVisible();
 await expect.poll(()=>image.evaluate((element:HTMLImageElement)=>element.naturalWidth)).toBe(1);
 expect(await image.getAttribute('src')).toBe(`/api/assets/${imageId}`);
});
test('hint code and tabs survive save reload ordering and tab removal',async({page},info)=>{
 const bodies=await editor(page);await page.getByRole('button',{name:'新增提示框',exact:true}).click();await page.getByLabel('提示类型',{exact:true}).selectOption('warning');await page.getByLabel('提示标题',{exact:true}).fill('执行前核对');await page.getByRole('textbox',{name:'提示内容',exact:true}).fill('第一行\n第二行');
 await page.getByRole('button',{name:'新增代码框',exact:true}).click();await page.getByLabel('代码语言',{exact:true}).fill('html');await page.getByRole('textbox',{name:'代码内容',exact:true}).fill(code);
 await page.getByRole('button',{name:'新增分页标签',exact:true}).click();await page.getByLabel('标签 1 标题',{exact:true}).fill('注册');await page.getByLabel('标签 1 内容',{exact:true}).fill('注册步骤');await page.getByLabel('标签 2 标题',{exact:true}).fill('转入');await page.getByLabel('标签 2 内容',{exact:true}).fill('转入步骤');
 await page.getByRole('region',{name:'编辑标签 2',exact:true}).getByRole('button',{name:'标签上移',exact:true}).click();await page.getByRole('button',{name:'保存草稿',exact:true}).click();await expect(page.getByRole('status')).toContainText('草稿已保存');await page.reload();await expect(page.getByRole('textbox',{name:'代码内容',exact:true})).toHaveValue(code);await expect(page.getByRole('textbox',{name:'提示内容',exact:true})).toHaveValue('第一行\n第二行');await expect(page.getByLabel('标签 1 标题',{exact:true})).toHaveValue('转入');expect(bodies[0].expectedSequence).toBe(0);
 await page.getByRole('button',{name:'删除标签 2',exact:true}).click();await expect(page.getByRole('button',{name:'删除标签 1',exact:true})).toBeDisabled();await page.getByRole('button',{name:'保存草稿',exact:true}).click();await expect(page.getByRole('status')).toContainText('草稿已保存');await page.screenshot({path:`output/verification/rich-editor-${info.project.name}.png`,fullPage:true});
});
test('advanced code keeps filename, line numbers, wrap and expansion across save and reading',async({page})=>{
 const bodies=await editor(page);await page.getByRole('button',{name:'新增代码框',exact:true}).click();await page.getByLabel('文件名或标题（可选）').fill('config.json');await page.getByLabel('显示行号').check();await page.getByLabel('重点行').fill('4');await page.getByLabel('新增行').fill('2');await page.getByLabel('删除行').fill('3');await page.getByLabel('长行自动换行').check();await page.getByLabel('长代码默认折叠').check();await page.getByLabel('折叠时显示行数').fill('2');await page.getByRole('textbox',{name:'代码内容',exact:true}).fill('第一行\n第二行\n第三行\n第四行');await page.getByRole('button',{name:'保存草稿',exact:true}).click();await expect(page.getByRole('status')).toContainText('草稿已保存');const saved=(bodies.at(-1)?.blocks as MediaBlock[]).find(block=>block.type==='code')!;await page.reload();await expect(page.getByLabel('文件名或标题（可选）')).toHaveValue('config.json');await expect(page.getByLabel('显示行号')).toBeChecked();
 await reader(page,[saved]);const box=page.getByRole('region',{name:'代码内容，可横向滚动'});await expect(page.getByText('config.json')).toBeVisible();await expect(page.locator('.rich-code')).toHaveClass(/has-line-numbers/);await expect(page.locator('.rich-code')).toHaveClass(/has-wrap/);await expect(page.locator('.rich-code')).toHaveClass(/is-collapsed/);await page.getByRole('button',{name:'展开全部 4 行'}).click();await expect(page.locator('.rich-code')).not.toHaveClass(/is-collapsed/);await expect(box).toContainText('第四行');await expect(page.locator('.rich-code-added')).toContainText('第二行');await expect(page.locator('.rich-code-removed')).toContainText('第三行');await expect(page.locator('.rich-code-highlighted')).toContainText('第四行');
});
test('tab rich text saves and reopens without showing serialized data',async({page})=>{
 const bodies=await editor(page);
 await page.getByRole('button',{name:'新增分页标签',exact:true}).click();
 const tab=page.getByRole('region',{name:'编辑标签 1',exact:true});
 await tab.getByRole('button',{name:'使用完整排版编辑'}).click();
 const nestedEditor=tab.locator('.rich-tab-body-editor [contenteditable=true]').first();await nestedEditor.click();await page.keyboard.type('/');await expect(page.locator('.bn-suggestion-menu')).toBeVisible();await expect(page.locator('.bn-suggestion-menu')).not.toContainText('扩展内容');await page.keyboard.press('Escape');await page.keyboard.press('Backspace');
 await nestedEditor.fill('已排版的步骤');
 await page.getByRole('button',{name:'保存草稿',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('草稿已保存');
 const saved=(bodies.at(-1)?.blocks as Array<{type:string;tabs?:Array<{body:string}>}>).find(block=>block.type==='tabs');
 expect(saved?.tabs?.[0].body).toContain('JUYU_TAB_BLOCKNOTE_V1');
 await page.reload();
 await expect(page.locator('.rich-tab-body-preview').first()).toContainText('已排版的步骤');
 await page.getByRole('button',{name:'编辑排版'}).first().click();
 await expect(page.locator('.rich-tab-body-editor').first()).toContainText('已排版的步骤');
 await reader(page,[saved as MediaBlock]);
 await expect(page.getByRole('tabpanel',{name:'标签 1'})).toContainText('已排版的步骤');
 await expect(page.getByText('JUYU_TAB_BLOCKNOTE_V1')).toHaveCount(0);
});
test('tabs support arrows home end click and independent sets with no overflow',async({page})=>{
 await reader(page,[blocks[0],{...(blocks[1] as Extract<MediaBlock,{type:'code'}>),code:code+'a'.repeat(1000)},blocks[2],{...(blocks[2] as Extract<MediaBlock,{type:'tabs'}>),id:'second-tabs'}]);const groups=page.getByRole('tablist',{name:'内容标签'});const first=groups.nth(0);await first.getByRole('tab',{name:'注册',exact:true}).focus();await page.keyboard.press('ArrowLeft');await expect(first.getByRole('tab',{name:'异常',exact:true})).toBeFocused();await expect(first.getByRole('tab',{name:'异常',exact:true})).toHaveAttribute('aria-selected','true');await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');await expect(first.getByRole('tab',{name:'转入',exact:true})).toBeFocused();await page.keyboard.press('End');await expect(first.getByRole('tab',{name:'异常',exact:true})).toBeFocused();await expect(groups.nth(1).getByRole('tab',{name:'异常',exact:true})).toHaveAttribute('aria-selected','true');
 await first.getByRole('tab',{name:'转入',exact:true}).click();await expect(page.getByRole('tabpanel',{name:'转入',exact:true}).first()).toBeVisible();await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'复制当前标签链接'}).first()).toBeFocused();await page.keyboard.press('Tab');await expect(page.getByRole('tabpanel',{name:'转入',exact:true}).first()).toBeFocused();expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);expect(await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(x=>x.id);return ids.length===new Set(ids).size;})).toBe(true);
 await page.emulateMedia({media:'print'});await expect(page.getByText('异常升级内容',{exact:true})).toHaveCount(2);await expect(page.getByText('异常升级内容',{exact:true}).first()).toBeVisible();
});
test('same-named tabs synchronize across groups and long tab rows expose an overflow menu',async({page})=>{
 const two={...(blocks[2] as Extract<MediaBlock,{type:'tabs'}>),id:'second-tabs'};
 await reader(page,[blocks[2],two]);
 const groups=page.getByRole('tablist',{name:'内容标签'});
 await groups.nth(0).getByRole('tab',{name:'转入',exact:true}).click();
 await expect(groups.nth(1).getByRole('tab',{name:'转入',exact:true})).toHaveAttribute('aria-selected','true');
 await page.setViewportSize({width:390,height:760});
 const long={id:'long-tabs',type:'tabs' as const,tabs:Array.from({length:8},(_,index)=>({id:`long-${index}`,title:`第 ${index+1} 个详细操作说明`,body:`内容 ${index+1}`,iconKey:index===0?'book' as const:null}))};
 await reader(page,[long]);
 await expect(page.locator('.rich-tabs-more summary')).toHaveText('更多标签');
 await page.getByText('更多标签',{exact:true}).click();
 await page.getByRole('group',{name:'全部内容标签'}).getByRole('button',{name:'第 8 个详细操作说明'}).click();
 await expect(page.getByRole('tab',{name:'第 8 个详细操作说明'})).toHaveAttribute('aria-selected','true');
 await expect(page.locator('svg.rich-tab-icon').first()).toBeVisible();
});
test('copy preserves actual clipboard bytes and literal code never runs in either theme',async({page,context},info)=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);await reader(page);await page.getByRole('button',{name:'复制代码',exact:true}).click();await expect(page.getByText('已复制',{exact:true})).toBeVisible();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(code);expect(await page.evaluate(()=>Object.hasOwn(window,'richInjected'))).toBe(false);
 for(const theme of ['浅色','深色']){await page.getByRole('radio',{name:theme,exact:true}).check();await expect(page.locator('html')).toHaveAttribute('data-theme',theme==='浅色'?'light':'dark');await expect(page.locator('.reader-pdf-link')).toBeVisible();await page.screenshot({path:`output/verification/rich-reader-${info.project.name}-${theme==='浅色'?'light':'dark'}.png`,fullPage:true});}
});
test('clipboard rejection never reports success and retry succeeds',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('DENIED');}}});});await reader(page);await page.getByRole('button',{name:'复制代码',exact:true}).click();await expect(page.getByText('复制失败，请选中代码后手动复制。',{exact:true})).toBeVisible();await expect(page.getByText('已复制',{exact:true})).toHaveCount(0);await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{}}});});await page.getByRole('button',{name:'复制代码',exact:true}).click();await expect(page.getByText('已复制',{exact:true})).toBeVisible();
});
test('invalid language retains draft text and copy waits for confirmation',async({page})=>{
 const bodies=await editor(page);await page.getByRole('button',{name:'新增代码框',exact:true}).click();await page.getByRole('textbox',{name:'代码内容',exact:true}).fill('保留这段');await page.getByLabel('代码语言',{exact:true}).fill('<script>');await expect(page.getByRole('alert')).toContainText('输入已保留');await expect(page.getByRole('button',{name:'保存草稿',exact:true})).toBeDisabled();expect(bodies).toHaveLength(0);await page.getByLabel('代码语言',{exact:true}).fill('text');await page.getByRole('button',{name:'保存草稿',exact:true}).click();await expect(page.getByRole('status')).toContainText('草稿已保存');
 await reader(page);await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>new Promise<void>(resolve=>{(window as unknown as {finishCopy:()=>void}).finishCopy=resolve;})}});});await page.getByRole('button',{name:'复制代码',exact:true}).click();await expect(page.getByRole('button',{name:'正在复制…',exact:true})).toBeDisabled();await expect(page.getByText('已复制',{exact:true})).toHaveCount(0);await page.evaluate(()=>(window as unknown as {finishCopy:()=>void}).finishCopy());await expect(page.getByText('已复制',{exact:true})).toBeVisible();
});
