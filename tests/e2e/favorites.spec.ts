import {test,expect,type Page} from '@playwright/test';import {favoritesBrowserBundle} from '../helpers/favorites-browser';
let bundle:Awaited<ReturnType<typeof favoritesBrowserBundle>>;test.beforeAll(async()=>{bundle=await favoritesBrowserBundle();});
async function mount(page:Page,props:()=>unknown=()=>({documentId:'favorite-local',revision:1}),mode='button'){
 await page.route('**/__favorites_fixture*',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.css}</style></head><body><header>收藏 · 本地测试样例（非真实员工资料）</header><main class="editor-main search-main"><div id="favorites"></div></main><script id="data" type="application/json">${JSON.stringify({mode,props:props()}).replace(/</g,'\\u003c')}</script><script>${bundle.script.replace(/<\/script/gi,'<\\/script')}</script></body></html>`}));await page.goto('/__favorites_fixture');
}
const item={id:'favorite-local',title:'常用问答 <script>只显示文字</script>',kind:'qa',revision:1,tags:['本地样例'],savedAt:'2026-09-09T01:00:00Z'};
test('favorites save cancel and focus refresh use server state without duplicate rapid writes',async({page})=>{
 let saved=false,reads=0,release!:()=>void;const held=new Promise<void>(r=>release=r),writes:unknown[]=[];
 await page.route('**/api/favorites/*',async r=>{if(r.request().method()==='GET'){reads++;return r.fulfill({json:{documentId:'favorite-local',revision:1,saved}});}const v=r.request().postDataJSON();writes.push(v);if(writes.length===1)await held;saved=v.saved;return r.fulfill({json:{documentId:'favorite-local',revision:1,saved}});});await mount(page);await expect(page.getByRole('button',{name:'收藏文章',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'收藏文章',exact:true}).evaluate(el=>{(el as HTMLButtonElement).click();(el as HTMLButtonElement).click();});await expect(page.getByRole('button',{name:'正在保存…'})).toBeDisabled();await expect.poll(()=>writes.length).toBe(1);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));expect(reads).toBe(1);release();await expect(page.getByRole('status')).toContainText('已加入我的收藏');expect(writes).toEqual([{revision:1,saved:true}]);
 await page.reload();await expect(page.getByRole('button',{name:'取消收藏',exact:true})).toBeEnabled();await page.getByRole('button',{name:'取消收藏',exact:true}).click();await expect(page.getByRole('status')).toContainText('已取消收藏');expect(writes[1]).toEqual({revision:1,saved:false});
 saved=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.getByRole('button',{name:'取消收藏',exact:true})).toHaveAttribute('aria-pressed','true');
});
test('unknown favorites result retains explicit action across a rejected retry and validates the acknowledgement',async({page})=>{
 const writes:unknown[]=[];await page.route('**/api/favorites/*',r=>{if(r.request().method()==='GET')return r.fulfill({json:{documentId:'favorite-local',revision:1,saved:false}});writes.push(r.request().postDataJSON());if(writes.length===1)return r.fulfill({json:{documentId:'wrong',revision:1,saved:true}});if(writes.length===2)return r.fulfill({status:403,json:{error:'FORBIDDEN'}});return r.fulfill({json:{documentId:'favorite-local',revision:1,saved:true}});});await mount(page);await page.getByRole('button',{name:'收藏文章',exact:true}).click();await expect(page.getByRole('alert')).toContainText('结果尚未确认');await expect(page.getByRole('status')).toHaveCount(0);await expect(page.getByRole('button',{name:'重新读取收藏'})).toHaveCount(0);await page.getByRole('button',{name:'重试收藏',exact:true}).click();await expect(page.getByRole('alert')).toContainText('结果尚未确认');await page.getByRole('button',{name:'重试收藏',exact:true}).click();await expect(page.getByRole('status')).toContainText('已加入');expect(writes).toEqual(Array(3).fill({revision:1,saved:true}));
});
test('failed reads and changed permission never claim an empty or successfully updated favorite state',async({page})=>{
 let unavailable=true;await page.route('**/api/favorites/*',r=>r.request().method()==='PUT'?r.fulfill({status:409,json:{error:'VERSION_CHANGED'}}):unavailable?r.fulfill({status:503,json:{error:'FAVORITES_UNAVAILABLE'}}):r.fulfill({json:{documentId:'favorite-local',revision:1,saved:false}}));await mount(page);await expect(page.getByRole('alert')).toContainText('暂时无法读取');await expect(page.getByRole('button',{name:'收藏文章',exact:true})).toBeDisabled();unavailable=false;await page.getByRole('button',{name:'重新读取收藏',exact:true}).click();await page.getByRole('button',{name:'收藏文章',exact:true}).click();await expect(page.getByRole('alert')).toContainText('操作未执行');await expect(page.getByRole('status')).toHaveCount(0);await expect(page.getByRole('link',{name:'刷新文章'})).toHaveAttribute('href','/help-centre/articles/favorite-local');
});
test('favorite list uses formal links real pagination and rereads after removing an item',async({page},info)=>{
 let present=true;await page.route('**/api/favorites?page=*',r=>r.fulfill({json:{items:[],total:0,page:1,pages:1}}));await page.route('**/api/favorites/*',r=>{expect(r.request().postDataJSON()).toEqual({revision:1,saved:false});present=false;return r.fulfill({json:{documentId:'favorite-local',revision:1,saved:false}});});await mount(page,()=>({state:'ready',data:{items:present?[item]:[],total:present?21:0,page:1,pages:present?2:1}}),'list');await expect(page.getByRole('link',{name:'阅读收藏：'+item.title})).toHaveAttribute('href','/help-centre/qa?question=favorite-local#qa-favorite-local');await expect(page.getByRole('status')).toContainText('21 篇可阅读');await expect(page.locator('.favorites-view script')).toHaveCount(0);await expect(page.getByRole('link',{name:'下一页',exact:true})).toHaveAttribute('href','/help-centre/favorites?page=2');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`output/verification/favorites-${info.project.name}.png`,fullPage:true,animations:'disabled'});await page.evaluate(()=>document.documentElement.dataset.theme='dark');await expect.poll(()=>page.getByRole('button',{name:'取消收藏',exact:true}).evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(57, 39, 46)');await page.screenshot({path:`output/verification/favorites-dark-${info.project.name}.png`,fullPage:true,animations:'disabled'});
 await page.getByRole('button',{name:'取消收藏',exact:true}).click();await expect(page.getByText('暂无可阅读的收藏',{exact:true})).toBeVisible();await expect(page.locator('.search-summary')).toContainText('0 篇可阅读');
});
test('favorite list failures suppress supplied metadata and unavailable services reject forged identities',async({page,request})=>{
 for(const state of ['denied','unavailable']){await mount(page,()=>({state,data:{items:[item],total:1,page:1,pages:1}}),'list');await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByRole('link',{name:'阅读收藏：'+item.title})).toHaveCount(0);await expect(page.getByRole('status')).toHaveCount(0);await page.unrouteAll();}
 for(const url of ['/api/favorites','/api/favorites/any?revision=1']){const r=await request.get(url,{headers:{'x-role':'admin','x-user-id':'other'}});expect(r.status()).toBe(503);expect(r.headers()['cache-control']).toBe('private, no-store');expect(await r.json()).toEqual({error:'FAVORITES_UNAVAILABLE'});}
 const r=await request.put('/api/favorites/any',{headers:{'x-role':'admin'},data:{revision:1,saved:true}});expect(r.status()).toBe(503);await page.goto('/help-centre/favorites');await expect(page).toHaveURL(/\/sign-in$/);
});
test('late response from another article cannot change the new article favorite button',async({page})=>{
 let release!:()=>void;const held=new Promise<void>(r=>release=r);await page.route('**/api/favorites/*',async r=>{const id=new URL(r.request().url()).pathname.split('/').pop()!;if(id==='favorite-local')await held;return r.fulfill({json:{documentId:id,revision:1,saved:id==='favorite-local'}});});await mount(page);await page.evaluate(()=>(window as unknown as {switchFavorite:(id:string)=>void}).switchFavorite('next'));await expect(page.getByRole('button',{name:'收藏文章',exact:true})).toBeEnabled();release();await expect(page.getByRole('button',{name:'收藏文章',exact:true})).toHaveAttribute('aria-pressed','false');
});
test('R12 cancellation updates only the list and failure retains the item for exact retry',async({page})=>{
 let writes=0;const other={...item,id:'second',title:'另一条资料'};
 await page.route('**/api/favorites?page=*',r=>r.fulfill({json:{items:[other],total:1,page:1,pages:1}}));
 await page.route('**/api/favorites/favorite-local',r=>{writes++;return writes===1?r.fulfill({status:503,json:{error:'UNKNOWN'}}):r.fulfill({json:{documentId:item.id,revision:1,saved:false}});});
 await mount(page,()=>({state:'ready',data:{items:[item,other],total:2,page:1,pages:1}}),'list');
 await page.evaluate(()=>{(window as unknown as {unchanged:string}).unchanged='same document';});
 const row=page.getByRole('region',{name:'收藏操作：'+item.title});await row.getByRole('button',{name:'取消收藏',exact:true}).click();await expect(row.getByRole('alert')).toContainText('尚未确认');await expect(page.getByRole('link',{name:'阅读收藏：'+item.title})).toBeVisible();
 await row.getByRole('button',{name:'重试取消收藏'}).click();await expect(page.getByRole('link',{name:'阅读收藏：'+item.title})).toHaveCount(0);await expect(page.getByRole('link',{name:'阅读收藏：另一条资料'})).toBeVisible();await expect(page.locator('.search-summary')).toContainText('共 1 篇');expect(writes).toBe(2);expect(await page.evaluate(()=>(window as unknown as {unchanged:string}).unchanged)).toBe('same document');
});
test('R12 a failed list refresh keeps other items and a removed last page adopts server pagination',async({page})=>{
 await page.route('**/api/favorites/favorite-local',r=>r.fulfill({json:{documentId:item.id,revision:1,saved:false}}));await page.route('**/api/favorites?page=*',r=>r.fulfill({status:503}));
 await mount(page,()=>({state:'ready',data:{items:[item,{...item,id:'second',title:'保留条目'}],total:22,page:2,pages:2}}),'list');await page.getByRole('region',{name:'收藏操作：'+item.title}).getByRole('button').click();await expect(page.getByRole('alert')).toContainText('最新列表暂时无法读取');await expect(page.getByRole('link',{name:'阅读收藏：保留条目'})).toBeVisible();await expect(page.locator('.search-summary')).toContainText('21 篇');
 await page.unroute('**/api/favorites?page=*');await page.route('**/api/favorites?page=*',r=>r.fulfill({json:{items:[{...item,id:'previous',title:'上一页内容'}],total:20,page:1,pages:1}}));await mount(page,()=>({state:'ready',data:{items:[item],total:21,page:2,pages:2}}),'list');await page.getByRole('button',{name:'取消收藏',exact:true}).click();await expect(page.getByRole('link',{name:'阅读收藏：上一页内容'})).toBeVisible();await expect(page.locator('.search-summary')).toContainText('第 1 / 1 页');
});

test('R13 all four content kinds link directly to their reader modules',async({page})=>{
 const items=['article','ops','qa','reference'].map(kind=>({...item,id:kind+' &资料',kind,title:kind}));
 await mount(page,()=>({state:'ready',data:{items,total:4,page:1,pages:1}}),'list');
 for(const kind of ['article','ops','qa','reference']){const encoded=encodeURIComponent(kind+' &资料');const href=kind==='qa'?'/help-centre/qa?question='+encoded+'#qa-'+encoded:kind==='reference'?'/help-centre/reference?article='+encoded:'/help-centre/articles/'+encoded;await expect(page.getByRole('link',{name:'阅读收藏：'+kind,exact:true})).toHaveAttribute('href',href);}
});

test('favorite state is isolated across sessions and logout clears the previous snapshot',async({page})=>{
 let saved=true,reads=0;await page.route('**/api/favorites/*',r=>{reads++;return r.fulfill({json:{documentId:'favorite-local',revision:1,saved}});});
 await mount(page);await expect(page.getByRole('button',{name:'取消收藏',exact:true})).toBeEnabled();expect(reads).toBe(1);
 saved=false;await page.evaluate(()=>(window as unknown as {switchFavoriteSession:(user:string,session:string)=>void}).switchFavoriteSession('second','session-b'));await expect(page.getByRole('button',{name:'收藏文章',exact:true})).toBeEnabled();expect(reads).toBe(2);
 await page.evaluate(()=>window.dispatchEvent(new Event('juyu-clear-recovery')));await expect(page.getByRole('button',{name:'收藏文章',exact:true})).toBeDisabled();
});

test('server supplied favorite avoids duplicate reads and focus rechecks revoked access',async({page})=>{
 let reads=0;await page.route('**/api/favorites/*',r=>{reads++;return r.fulfill({status:403,json:{error:'FORBIDDEN'}});});
 await mount(page,()=>({documentId:'favorite-local',revision:1,initial:{documentId:'favorite-local',revision:1,saved:true}}));await expect(page.getByRole('button',{name:'取消收藏',exact:true})).toBeEnabled();expect(reads).toBe(0);
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.getByRole('alert')).toContainText('当前无法访问');await expect(page.getByRole('button',{name:'收藏文章',exact:true})).toBeDisabled();expect(reads).toBe(1);
});

test('logout clears favorite cache even after the button has unmounted',async({page})=>{
 let saved=true,reads=0;await page.route('**/api/favorites/*',r=>{reads++;return r.fulfill({json:{documentId:'favorite-local',revision:1,saved}});});await mount(page);await expect(page.getByRole('button',{name:'取消收藏',exact:true})).toBeEnabled();
 await page.evaluate(()=>(window as unknown as {unmountFavorite:()=>void}).unmountFavorite());await expect(page.locator('.favorite-control')).toHaveCount(0);saved=false;
 await page.evaluate(()=>{window.dispatchEvent(new Event('juyu-clear-recovery'));(window as unknown as {switchFavorite:(id:string)=>void}).switchFavorite('favorite-local');});await expect(page.getByRole('button',{name:'收藏文章',exact:true})).toBeEnabled();expect(reads).toBe(2);
});
