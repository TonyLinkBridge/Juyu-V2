import {test,expect,type Page} from '@playwright/test';
import {qaBrowserBundle} from '../helpers/qa-browser';
let bundle:Awaited<ReturnType<typeof qaBrowserBundle>>;
test.beforeAll(async()=>{bundle=await qaBrowserBundle();});
async function mount(page:Page,options:{state?:string;empty?:boolean;searchEnabled?:boolean;admin?:boolean}={}){
 const qaView={viewerId:'fixture',searchEnabled:options.searchEnabled??true,state:options.state??'ready',data:{q:'',categories:['账户'],topics:['信用额度','签约店铺'],items:options.empty?[]:[{id:'qa-local',title:'如何核对 <script>账户</script>？',revision:1,tags:['信用额度','签约店铺']},{id:'qa-mfa',title:'MFA 验证器误删了怎么办？',revision:1,tags:['账户安全']}],total:options.empty?0:21,page:1,pages:options.empty?1:2,canEdit:options.admin??false}};
 await page.route('**/__qa_fixture',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.css}</style></head><body><div id="presentation"></div><script id="data" type="application/json">${JSON.stringify({qaView}).replaceAll('<','\\u003c')}</script><script>${bundle.script.replaceAll('</script','<\\/script')}</script></body></html>`}));await page.goto('/__qa_fixture');
}
test('Q&A shows published question titles safely with real pagination and gated search',async({page})=>{
 await mount(page);const answer=page.getByRole('button',{name:'如何核对 <script>账户</script>？'});await expect(answer).toBeVisible();await expect(page.locator('.qa-question script')).toHaveCount(0);await expect(page.getByRole('navigation',{name:'相关话题'}).getByRole('link',{name:'签约店铺'})).toHaveAttribute('href','/help-centre/qa?page=1&topic=%E7%AD%BE%E7%BA%A6%E5%BA%97%E9%93%BA');await expect(page.getByRole('list',{name:'相关话题：如何核对 <script>账户</script>？'}).getByRole('listitem')).toHaveText(['信用额度','签约店铺']);await expect(page.getByRole('link',{name:'下一页'})).toHaveAttribute('href','/help-centre/qa?page=2');await expect(page.getByRole('button',{name:'搜索问答'})).toBeVisible();
 await mount(page,{searchEnabled:false});await expect(page.locator('.qa-search')).toHaveCount(0);await expect(page.getByRole('button',{name:/如何核对/})).toBeVisible();
});
test('Q&A denied and unavailable suppress supplied private titles and give actions',async({page})=>{
 for(const state of ['denied','unavailable']){await mount(page,{state,admin:true});await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByRole('button',{name:/如何核对/})).toHaveCount(0);await expect(page.getByRole('link',{name:'管理问答 →'})).toHaveCount(0);await expect(page.getByRole('link',{name:'重新读取'})).toBeVisible();}
});
test('Q&A empty and admin management states explain published scope',async({page})=>{
 await mount(page,{empty:true,admin:true});await expect(page.getByRole('heading',{name:'暂时没有找到相关答案'})).toBeVisible();await expect(page.getByRole('link',{name:'管理问答 →'})).toHaveAttribute('href','/admin?kind=qa&view=list');await expect(page.getByText('标准问答 · 0 个问题')).toBeVisible();
});
test('Q&A expands the selected answer in place without navigating away',async({page})=>{
 await page.route('**/api/qa/qa-local',route=>route.fulfill({json:{id:'qa-local',title:'如何核对账户？',revision:1,body:'标准答案：请核对账户资料。',blocks:[]}}));
 await mount(page);
 const before=page.url();
 await page.getByRole('button',{name:'如何核对 <script>账户</script>？'}).click();
 await expect(page.getByText('标准答案：请核对账户资料。',{exact:true})).toBeVisible();
 await expect(page.getByRole('searchbox',{name:'搜索问题或答案'})).toBeVisible();
 await expect(page.getByRole('button',{name:'MFA 验证器误删了怎么办？'})).toBeVisible();
 expect(page.url()).toBe(before);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
});
test('actual Q&A routes reject unconfigured forged identities',async({page,request})=>{
 const r=await request.get('/api/qa',{headers:{'x-role':'admin','x-user-id':'a'}});expect(r.status()).toBe(503);expect(r.headers()['cache-control']).toBe('private, no-store');await page.goto('/help-centre/qa');await expect(page).toHaveURL(/\/sign-in$/);
});

for(const format of ['native','legacy'] as const)test(`Q&A ${format} images keep zoom and captions without file actions while attachments remain downloadable`,async({page})=>{
 const asset='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const image={id:'qa-picture',type:'image',assetId:asset,alt:'问答截图',caption:'问答图片说明'};
 const file={id:'qa-attachment',type:'file',assetId:asset,alt:'附件说明',caption:'供下载的附件'};
 const body=format==='native'?'JUYU_BLOCKNOTE_V1\n'+JSON.stringify([
  {id:'qa-picture',type:'image',props:{url:'/api/assets/'+asset,name:'问答截图',caption:'问答图片说明'},children:[]},
  {id:'qa-attachment',type:'file',props:{url:'/api/assets/'+asset,name:'附件说明',caption:'供下载的附件'},children:[]},
 ]):'标准答案';
 await page.route('**/api/qa/qa-local',route=>route.fulfill({json:{id:'qa-local',title:'如何核对账户？',revision:1,body,blocks:format==='legacy'?[image,file]:[]}}));
 await page.route('**/api/assets/**',route=>route.fulfill({path:'tests/fixtures/article-cover.png',contentType:'image/png'}));
 await mount(page);await page.getByRole('button',{name:'如何核对 <script>账户</script>？'}).click();
 const gallery=page.locator('.reader-image-gallery');await expect(gallery.getByAltText('问答截图')).toBeVisible();
 await expect(gallery).toContainText('问答图片说明');await expect(gallery.getByRole('link')).toHaveCount(0);
 const attachment=page.locator(format==='native'?'.native-file':'.media-file');
 await expect(attachment.locator('a[download]')).toHaveAttribute('href','/api/assets/'+asset+'?download=1');
 const before=page.url();await gallery.getByRole('button',{name:'放大图片：问答截图'}).click();
 const dialog=page.getByRole('dialog',{name:'图片放大查看'});await expect(dialog).toBeVisible();await expect(dialog.getByAltText('问答截图')).toBeVisible();
 await dialog.getByRole('button',{name:'关闭图片'}).click();await expect(dialog).toBeHidden();expect(page.url()).toBe(before);
});
