import {normalizeEditorBlocks} from '../../src/editor/document';
import {nativeReferenceTable} from '../../src/reference/native';
import {test,expect,type Page} from '@playwright/test';import {referenceBrowserBundle} from '../helpers/reference-browser';
let bundle:Awaited<ReturnType<typeof referenceBrowserBundle>>;
test.beforeAll(async()=>{bundle=await referenceBrowserBundle();});
const detail={id:'ref-local',title:'速查资料 · 本地测试样例',revision:2,tags:['示例'],tables:[{id:'one',headers:['注册商','办理规则','说明'],rows:Array.from({length:45},(_,i)=>[`示例注册商 ${i+1}`,i%2?'续费核对':'转出 EPP 核对',i===2?'<script>示例仅作文字</script>':'请按正式资料核对'])},{id:'two',headers:['项目','说明'],rows:[['独立表格','不会随另一张表筛选']]}]};

const text=(text:string,styles={})=>[{type:'text',text,styles}];
const richBlock=normalizeEditorBlocks([{id:'rich',type:'table',props:{textColor:'blue'},content:{type:'tableContent',columnWidths:[140,160,280],headerRows:2,rows:[
 {cells:[{type:'tableCell',props:{rowspan:2},content:text('业务')},{type:'tableCell',props:{colspan:2,backgroundColor:'yellow'},content:text('费用规则',{bold:true})}]},
 {cells:[text('价格'),text('注意事项')]},
 ...Array.from({length:25},(_,i)=>({cells:[...(i===0?[{type:'tableCell',props:{rowspan:25,backgroundColor:'yellow'},content:text('域名服务')}]:[]),text(String(i+1)),{type:'tableCell',props:{textAlignment:'right'},content:i===20?[...text('不可退款',{bold:true,italic:true,strike:true,textColor:'red',backgroundColor:'yellow'}),{type:'link',href:'https://example.com/rules',content:text('查看规则',{underline:true})},...text('<script>示例</script>',{code:true})]:text('正常办理')}]})),
]}}])[0];
if(richBlock.type!=='table')throw Error('Invalid rich fixture');
const richTable=nativeReferenceTable(richBlock);

async function mount(page:Page,options:{admin?:boolean;state?:'ready'|'denied'|'unavailable';detailState?:'ready'|'idle'|'unavailable';noTables?:boolean;empty?:boolean;rich?:boolean}={}){
 const data={state:options.state??'ready',detailState:options.detailState??'ready',data:{items:options.empty?[]:[detail],total:options.empty?0:1,page:1,pages:1,canEdit:options.admin??false},detail:{...detail,tables:options.noTables?[]:options.rich?[richTable]:detail.tables}};
 await page.route('**/__reference_fixture',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.css}</style></head><body><header>Reference · 本地测试样例（非真实业务资料）</header><main id="main-content" class="editor-main search-main"><div id="reference"></div></main><script id="data" type="application/json">${JSON.stringify(data).replace(/</g,'\\u003c')}</script><script>${bundle.script.replace(/<\/script/gi,'<\\/script')}</script></body></html>`}));await page.goto('/__reference_fixture');await expect(page.getByRole('heading',{name:'速查资料',exact:true})).toBeVisible();
}
test('formal tables filter Chinese keywords by column and paginate without editing or leaking markup',async({page},info)=>{
 await mount(page);const table=page.getByRole('region',{name:'速查表 1',exact:true});await expect(table.getByRole('status')).toContainText('共 45 行 · 符合 45 行');await table.getByRole('button',{name:'下一页',exact:true}).click();await expect(table.getByRole('rowheader').first()).toHaveText('21');await table.getByRole('textbox',{name:'筛选表格'}).fill('转出 epp');await expect(table.getByRole('status')).toContainText('符合 23 行 · 第 1 / 2 页');await expect(page.getByRole('region',{name:'速查表 2',exact:true})).toContainText('不会随另一张表筛选');await table.getByRole('combobox',{name:'筛选范围'}).selectOption('0');await expect(table).toContainText('没有符合条件的行');await table.getByRole('button',{name:'清除筛选'}).click();await table.getByRole('textbox',{name:'筛选表格'}).fill('script');await expect(table.getByRole('cell',{name:'<script>示例仅作文字</script>'})).toBeVisible();await expect(table.locator('script')).toHaveCount(0);await table.getByRole('button',{name:'清除筛选'}).click();
 await expect(page.getByRole('link',{name:'编辑此资料'})).toHaveCount(0);await expect(page.getByRole('link',{name:'新建速查资料'})).toHaveCount(0);await page.getByText('其他操作',{exact:true}).click();await expect(page.getByRole('link',{name:'完整正式版 PDF'})).toHaveAttribute('href','/help-centre/pdf?article=ref-local&revision=2');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`output/verification/reference-${info.project.name}.png`,fullPage:true,animations:'disabled'});await page.evaluate(()=>document.documentElement.dataset.theme='dark');await page.screenshot({path:`output/verification/reference-dark-${info.project.name}.png`,fullPage:true,animations:'disabled'});
});
test('admin uses existing review editor and invalid filters can be corrected with current rows preserved',async({page})=>{
 await mount(page,{admin:true});await expect(page.getByRole('link',{name:'新建速查资料'})).toHaveAttribute('href','/admin/editor?kind=reference');await page.getByText('其他操作',{exact:true}).click();await expect(page.getByRole('link',{name:'编辑此资料'})).toHaveAttribute('href','/admin/editor?article=ref-local');const table=page.getByRole('region',{name:'速查表 1',exact:true});await table.getByRole('textbox').fill('字'.repeat(121));await expect(table.getByRole('alert')).toContainText('最多 120');await table.getByRole('button',{name:'清除筛选'}).click();await expect(table.getByRole('status')).toContainText('共 45 行');
});
test('denied unavailable empty and no-table states never substitute or expose private tables',async({page})=>{
 for(const state of ['denied','unavailable'] as const){await mount(page,{state,admin:true});await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByRole('table')).toHaveCount(0);await expect(page.getByRole('link',{name:'编辑此资料'})).toHaveCount(0);await expect(page.getByText('共 1 篇正式资料')).toHaveCount(0);await page.unrouteAll();}
 await mount(page,{detailState:'unavailable'});await expect(page.getByRole('alert')).toContainText('所选速查资料暂时无法读取');await expect(page.getByRole('table')).toHaveCount(0);await page.unrouteAll();await mount(page,{noTables:true});await expect(page.getByText('这篇正式资料还没有表格，可以阅读全文。')).toBeVisible();await page.unrouteAll();await mount(page,{empty:true,detailState:'idle'});await expect(page.getByText('暂时没有已发布的速查资料')).toBeVisible();await expect(page.getByText('从上方选择资料，即可查看表格。')).toHaveCount(0);
});
test('actual Reference entry and API refuse unconfigured forged identities',async({page,request})=>{
 for(const query of ['', '?article=ref-local']){const r=await request.get('/api/reference'+query,{headers:{'x-role':'admin','x-user-id':'a'}});expect(r.status()).toBe(503);expect(r.headers()['cache-control']).toBe('private, no-store');expect(await r.json()).toEqual({error:'REFERENCE_UNAVAILABLE'});}
 await page.goto('/help-centre/reference');await expect(page).toHaveURL(/\/sign-in$/);await page.goto('/admin/editor?kind=reference');await expect(page.locator('.bn-editor')).toHaveCount(0);
});

test('R17 rich formats links and merged cells survive filtering pagination and themes',async({page},info)=>{
 await mount(page,{rich:true});
 const section=page.getByRole('region',{name:'速查表 1',exact:true});
 const table=section.getByRole('table');
 await expect(table.getByRole('columnheader',{name:'费用规则',exact:true})).toHaveAttribute('colspan','2');
 await expect(table.getByRole('cell',{name:'域名服务',exact:true})).toHaveAttribute('rowspan','20');
 await section.getByRole('button',{name:'下一页',exact:true}).click();
 await expect(table.getByRole('cell',{name:'域名服务',exact:true})).toHaveAttribute('rowspan','5');
 await expect(table.getByRole('rowheader').first()).toHaveText('21');
 for(const theme of ['light','dark']){
  await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);
  const marked=table.locator('span').filter({has:page.locator('strong')}).filter({hasText:'不可退款'});
  await expect(marked).toHaveCSS('color','rgb(224, 62, 62)');
  await expect(marked).toHaveCSS('background-color','rgb(251, 243, 219)');
  await expect(marked.locator('s')).toHaveText('不可退款');await expect(marked.locator('em')).toHaveText('不可退款');
  await expect(table.getByRole('link',{name:'查看规则'})).toHaveAttribute('href','https://example.com/rules');
  await expect(table.getByRole('link',{name:'查看规则'}).locator('u')).toHaveText('查看规则');
  await expect(table.locator('code')).toHaveText('<script>示例</script>');await expect(table.locator('script')).toHaveCount(0);
  await expect(table.getByRole('cell').filter({has:page.getByRole('link',{name:'查看规则'})})).toHaveCSS('text-align','right');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`output/verification/reference-rich-${theme}-${info.project.name}.png`,fullPage:true,animations:'disabled'});
 }
 await section.getByRole('textbox',{name:'筛选表格'}).fill('不可退款');
 await expect(table.getByRole('cell',{name:'域名服务',exact:true})).toHaveAttribute('rowspan','1');
 await expect(table.getByRole('rowheader').first()).toHaveText('21');
 await expect(table.getByRole('link',{name:'查看规则'})).toBeVisible();
 await section.getByRole('combobox',{name:'筛选范围'}).selectOption('0');
 await expect(section).toContainText('没有符合条件的行');
 await section.getByRole('textbox',{name:'筛选表格'}).fill('域名服务');
 await expect(section.getByRole('status')).toContainText('符合 25 行');
 await section.getByRole('button',{name:'清除筛选'}).click();
 await expect(table.getByRole('cell',{name:'域名服务',exact:true})).toHaveAttribute('rowspan','20');
});

test('R07 compact selection exposes the current table without an extra read action',async({page},info)=>{
 await mount(page,{admin:true});await expect(page.getByRole('navigation',{name:'选择速查资料'}).getByRole('link')).toHaveAttribute('aria-current','page');await expect(page.getByRole('region',{name:'速查表 1',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'阅读全文'})).toBeHidden();await page.getByText('其他操作',{exact:true}).click();await expect(page.getByRole('link',{name:'编辑此资料'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`output/verification/R07-reference-${info.project.name}.png`,fullPage:true});
});
