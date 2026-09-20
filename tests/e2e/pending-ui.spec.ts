import {test,expect,type Page} from '@playwright/test';
import {navigationBrowserBundle} from '../helpers/navigation-browser';
import {workspaceQuery,statuses} from '../../src/workspace/model';
let bundle:Awaited<ReturnType<typeof navigationBrowserBundle>>;
test.beforeAll(async()=>{bundle=await navigationBrowserBundle();});
const data=(kind:string)=>({query:workspaceQuery({kind,view:'list',q:'邮箱'}),items:[],total:0,page:1,pages:1,counts:Object.fromEntries(statuses.map(s=>[s.id,0]))});
async function mount(page:Page,props:unknown){await page.route('**/__pending',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.css}</style></head><body><div id="presentation"></div><script id="data" type="application/json">${JSON.stringify({pendingWorkspace:props})}</script><script>${bundle.script.replaceAll('</script','<\\/script')}</script></body></html>`}));await page.goto('/__pending');}
test('module navigation resets uncontrolled filters and clear stays in Q&A',async({page})=>{
 await mount(page,{data:data('qa')});await expect(page.getByLabel('资料类型')).toHaveValue('qa');await expect(page.getByRole('link',{name:'清除筛选'})).toHaveAttribute('href',/kind=qa/);await expect(page.getByPlaceholder('输入问题')).toBeVisible();
 await page.evaluate(props=>(window as unknown as {updatePendingWorkspace:(props:unknown)=>void}).updatePendingWorkspace(props),{data:data('reference')});await expect(page.getByLabel('资料类型')).toHaveValue('reference');
 await expect(page.getByText(/下列数字按当前工作版状态统计/)).toBeVisible();
});
test('failed QA workspace keeps module and retry query',async({page})=>{
 await mount(page,{query:workspaceQuery({kind:'qa',q:'邮箱'}),retryHref:'/admin?kind=qa&q=邮箱',error:'服务暂不可用'});await expect(page.getByRole('heading',{name:'Q&A 管理'})).toBeVisible();await expect(page.getByRole('link',{name:'重新读取内容'})).toHaveAttribute('href','/admin?kind=qa&q=邮箱');await expect(page.getByRole('status')).not.toContainText('共 0');
});
