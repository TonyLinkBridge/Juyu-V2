import {test,expect,type Page} from '@playwright/test';
import {qaBrowserBundle} from '../helpers/qa-browser';
let bundle:Awaited<ReturnType<typeof qaBrowserBundle>>;
test.beforeAll(async()=>{bundle=await qaBrowserBundle();});
async function mount(page:Page,options:{state?:string;empty?:boolean;searchEnabled?:boolean;admin?:boolean}={}){
 const qaView={viewerId:'fixture',searchEnabled:options.searchEnabled??true,state:options.state??'ready',data:{q:'',categories:['账户'],items:options.empty?[]:[{id:'qa-local',title:'如何核对 <script>账户</script>？',revision:1}],total:options.empty?0:21,page:1,pages:options.empty?1:2,canEdit:options.admin??false}};
 await page.route('**/__qa_fixture',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.css}</style></head><body><div id="presentation"></div><script id="data" type="application/json">${JSON.stringify({qaView}).replaceAll('<','\\u003c')}</script><script>${bundle.script.replaceAll('</script','<\\/script')}</script></body></html>`}));await page.goto('/__qa_fixture');
}
test('Q&A shows published question titles safely with real pagination and gated search',async({page})=>{
 await mount(page);await expect(page.getByRole('button',{name:'如何核对 <script>账户</script>？'})).toBeVisible();await expect(page.locator('.qa-question script')).toHaveCount(0);await expect(page.getByRole('link',{name:'下一页'})).toHaveAttribute('href','/help-centre/qa?page=2');await expect(page.getByRole('button',{name:'搜索问答'})).toBeVisible();
 await mount(page,{searchEnabled:false});await expect(page.locator('.qa-search')).toHaveCount(0);await expect(page.getByRole('button',{name:/如何核对/})).toBeVisible();
});
test('Q&A denied and unavailable suppress supplied private titles and give actions',async({page})=>{
 for(const state of ['denied','unavailable']){await mount(page,{state,admin:true});await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByRole('button',{name:/如何核对/})).toHaveCount(0);await expect(page.getByRole('link',{name:'管理问答 →'})).toHaveCount(0);await expect(page.getByRole('link',{name:'重新读取'})).toBeVisible();}
});
test('Q&A empty and admin management states explain published scope',async({page})=>{
 await mount(page,{empty:true,admin:true});await expect(page.getByRole('heading',{name:'暂时没有找到相关答案'})).toBeVisible();await expect(page.getByRole('link',{name:'管理问答 →'})).toHaveAttribute('href','/admin?kind=qa&view=list');await expect(page.getByText('标准问答 · 0 个问题')).toBeVisible();
});
test('actual Q&A routes reject unconfigured forged identities',async({page,request})=>{
 const r=await request.get('/api/qa',{headers:{'x-role':'admin','x-user-id':'a'}});expect(r.status()).toBe(503);expect(r.headers()['cache-control']).toBe('private, no-store');await page.goto('/help-centre/qa');await expect(page).toHaveURL(/\/sign-in$/);
});
