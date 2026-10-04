import {test,expect,type Page} from '@playwright/test';
import {developersBrowserBundle} from '../helpers/developers-browser';
import {integrationCatalog} from '../../src/developers/model';
let bundle:Awaited<ReturnType<typeof developersBrowserBundle>>;
test.beforeAll(async()=>{bundle=await developersBrowserBundle();});
async function mount(page:Page,section:string,frame=false){
 await page.route('**/__developers_bundle.js',r=>r.fulfill({contentType:'text/javascript',body:bundle.script}));
 await page.route('**/__developers_fixture*',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.css}</style></head><body><header>本地界面测试 · 示例数据，非生产验收</header><div id="developers"></div><script src="/__developers_bundle.js"></script></body></html>`}));await page.goto('/__developers_fixture?section='+section+(frame?'&frame=1':''));
}
const event={id:'event:1',at:'2026-10-02T07:00:00Z',source:'publication-client',level:'warning',name:'blocked',title:null,actor:'Haley',documentId:'00000000-0000-4000-8000-000000000001',status:null,durationMs:null,detail:{reason:'uploading',attempt:'00000000-0000-4000-8000-000000000002'}};
test('overview shows measured scope, real status distinctions and responsive JUYU layout',async({page},info)=>{
 await page.route('**/api/admin/developers/overview?**',r=>r.fulfill({json:{days:30,integrations:integrationCatalog({}),release:'local-test',requests:{count:8,failed:2,averageMs:53,minimumMs:15,maximumMs:120,since:'2026-10-02T06:00:00Z'},timeline:[{day:'2026-10-02',count:8,failed:2,averageMs:53}],notificationTimeline:[{day:'2026-10-02',sent:4,failed:1,pending:2}],notifications:{sent:4,failed:1,pending:2},recent:[event]}}));
 await mount(page,'overview');await expect(page.getByText('仅统计图片与附件读取、PDF 导出和发布接口', {exact:false})).toBeVisible();await expect(page.locator('.developer-metric-inline dd').filter({hasText:'53 ms'})).toBeVisible();await expect(page.getByText('待配置',{exact:true})).toHaveCount(5);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`output/verification/developers-overview-${info.project.name}.png`,fullPage:true});
 await page.evaluate(()=>document.documentElement.classList.add('dark'));await page.screenshot({path:`output/verification/developers-overview-dark-${info.project.name}.png`,fullPage:true});
});
test('events filters, pagination and missing-schema errors work without stale records',async({page})=>{
 const queries:string[]=[];await page.route('**/api/admin/developers/events?**',r=>{const q=new URL(r.request().url()).searchParams;queries.push(q.toString());return r.fulfill({json:{items:q.get('q')==='empty'?[]:[event],page:Number(q.get('page')),hasNext:q.get('page')==='1',filter:{},summary:{total:q.get('q')==='empty'?0:34,levels:{info:0,warning:34,error:0},interfaces:[],articles:[],sources:q.get('q')==='empty'?[]:[{id:'publication-client',count:34}]}}});});
 await mount(page,'events-logs');await page.locator('.developer-filter-rail summary').filter({hasText:'事件来源'}).click();await page.getByLabel('事件来源').selectOption('publication-client');await page.getByRole('checkbox',{name:/注意/}).check();await page.getByLabel('搜索事件').fill('Haley');await expect.poll(()=>queries.at(-1)).toContain('q=Haley');expect(queries.at(-1)).toContain('source=publication-client');expect(queries.at(-1)).toContain('levels=warning');
 await page.getByRole('button',{name:'下一页'}).click();await expect.poll(()=>queries.at(-1)).toContain('page=2');await page.getByRole('button',{name:'查看详情'}).first().click();await expect(page.getByText('正在上传文件',{exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'查看对应文章'})).toHaveAttribute('href','/admin/editor?article='+event.documentId);
 await page.getByRole('button',{name:'关闭详情'}).click();await page.getByLabel('搜索事件').fill('empty');await expect(page.getByRole('status')).toContainText('没有匹配');
 await page.route('**/api/admin/developers/events?**',r=>r.fulfill({status:503,json:{error:'DEVELOPERS_NOT_READY'}}));await page.getByRole('button',{name:'刷新',exact:true}).click();await expect(page.getByRole('alert')).toContainText('0056');await expect(page.getByText('Haley',{exact:true})).toHaveCount(0);
});
test('checks show failure and retry confirmation keeps an operation ID after uncertain response',async({page})=>{
 const integrations=integrationCatalog({SLACK_BOT_TOKEN:'test',SLACK_NOTIFICATION_CHANNEL_ID:'C123456789',ALLOWED_SLACK_TEAM_ID:'T123456789',APP_ORIGIN:'https://example.test'});
 await page.route('**/api/admin/developers/integrations',r=>r.request().method()==='POST'?r.fulfill({json:{...integrations[3],check:'failed',code:'SLACK_WORKSPACE_MISMATCH',scope:'bot_identity_only',checkedAt:new Date().toISOString()}}):r.fulfill({json:integrations}));
 await mount(page,'api-keys');await page.getByRole('button',{name:'检查 Slack 通知'}).click();await expect(page.getByText('Slack 工作区不匹配',{exact:true})).toBeVisible();
 await page.route('**/api/admin/developers/webhooks?**',r=>r.fulfill({json:{items:[{documentId:event.documentId,sequence:2,event:'updated',title:'普通会员',actor:'Haley',createdAt:event.at,attempts:2,nextAttemptAt:event.at,sentAt:null,leaseUntil:null,lastError:'timeout',state:'failed'}],page:1,hasNext:false,totals:{sent:0,failed:1,pending:0},configured:true,channel:'C123456789',retryConfigured:true}}));
 const ids:string[]=[];await page.route('**/api/admin/developers/webhooks',r=>{ids.push(r.request().postDataJSON().requestId);return ids.length===1?r.fulfill({status:503,json:{error:'DEVELOPERS_UNAVAILABLE'}}):ids.length===2?r.fulfill({json:{}}):r.fulfill({json:{scheduled:false}});});
 await mount(page,'webhooks');await page.getByRole('button',{name:'重试通知'}).click();const dialog=page.getByRole('dialog');await expect(dialog).toContainText('普通会员');await dialog.getByRole('button',{name:'确认重试'}).click();await expect(dialog.getByRole('alert')).toContainText('无法确认');await dialog.getByRole('button',{name:'确认重试'}).click();await expect(dialog.getByRole('alert')).toContainText('无法确认');await dialog.getByRole('button',{name:'确认重试'}).click();await expect(dialog).toHaveCount(0);expect(ids).toHaveLength(3);expect(new Set(ids).size).toBe(1);await expect(page.getByRole('status')).toContainText('已经安排');
});
test('actual APIs and pages reject forged Super Admin headers without configured login',async({page,request})=>{
 for(const endpoint of ['access','overview','integrations','webhooks','events']){const response=await request.get('/api/admin/developers/'+endpoint,{headers:{'x-role':'super_admin'}});expect(response.status()).toBe(503);expect(response.headers()['cache-control']).toBe('private, no-store');}
 await page.goto('/admin/developers/overview');await expect(page).toHaveURL(/\/admin\/sign-in$/);
 await expect(page.getByRole('link',{name:'Overview'})).toHaveCount(0);
});

test('live refresh preserves a detail being read even when newer events replace the current page',async({page})=>{
 let calls=0;const original={...event,id:'event:original'};
 await page.route('**/api/admin/developers/events?**',r=>{calls++;return r.fulfill({json:{items:calls<3?[original]:[{...event,id:'event:new',actor:'Other'}],page:1,hasNext:false,filter:{},summary:{total:42,levels:{info:0,warning:42,error:0},interfaces:[{id:'asset',count:8}],articles:[{id:event.documentId,title:'普通会员',count:5}],sources:[{id:'publication-client',count:42}]}}});});
 await mount(page,'events-logs');await expect(page.getByText('42 条',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'文章',exact:true}).click();await expect(page.getByRole('link',{name:'普通会员',exact:true})).toBeVisible();
 await page.clock.install();await page.getByRole('button',{name:'实时',exact:true}).click();await expect.poll(()=>calls).toBe(2);
 await page.getByRole('button',{name:/查看详情：/}).click();const detail=page.getByRole('dialog',{name:'事件详情'});await expect(detail).toContainText('Haley');
 await page.clock.fastForward(20000);await expect.poll(()=>calls).toBe(3);await expect(detail).toBeVisible();await expect(detail).toContainText('Haley');
 await page.getByRole('button',{name:'关闭详情'}).click();await page.getByRole('button',{name:'暂停',exact:true}).click();await expect.poll(()=>calls).toBe(4);await page.clock.fastForward(20000);expect(calls).toBe(4);
});
test('custom date, whole-filter rankings and current-page export are usable',async({page})=>{
 const queries:string[]=[];await page.route('**/api/admin/developers/events?**',r=>{queries.push(new URL(r.request().url()).searchParams.toString());return r.fulfill({json:{items:[event],page:1,hasNext:false,filter:{},summary:{total:90,levels:{info:10,warning:70,error:10},interfaces:[{id:'asset',count:35}],articles:[],sources:[{id:'request',count:35},{id:'publication-client',count:55}]}}});});
 await mount(page,'events-logs');await page.getByLabel('日志时间范围').selectOption('custom');await page.getByLabel('自定义日期').fill('2026-10-03');await expect.poll(()=>queries.at(-1)).toContain('date=2026-10-03');
 await expect(page.getByText('90 条',{exact:true})).toBeVisible();await expect(page.getByText('图片与附件读取',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'查看全部',exact:true}).first().click();await expect(page.getByRole('dialog',{name:'接口记录'})).toContainText('35');await page.getByRole('button',{name:'关闭详情'}).click();
 await page.getByLabel('更多日志操作').click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出当前页 CSV'}).click();expect((await download).suggestedFilename()).toBe('juyu-events-page-1.csv');
});

test('existing admin navigation keeps Developer links reachable on small screens',async({page},info)=>{
 await page.route('**/api/admin/developers/events?**',r=>r.fulfill({json:{items:[],page:1,hasNext:false,filter:{},summary:{total:0,levels:{info:0,warning:0,error:0},interfaces:[],articles:[],sources:[]}}}));
 await mount(page,'events-logs',true);
 if(info.project.name==='mobile'){
  await page.getByText('管理导航',{exact:true}).click();
  expect(await page.locator('.admin-mobile-nav').evaluate(e=>e.getBoundingClientRect().height)).toBeLessThan(780);
 }
 await page.getByRole('link',{name:'API Keys',exact:true}).click();await expect(page).toHaveURL(/\/admin\/sign-in$/);
});
