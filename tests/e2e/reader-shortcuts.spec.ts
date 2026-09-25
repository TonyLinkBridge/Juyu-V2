import {test,expect,type Page} from '@playwright/test';
import {navigationBrowserBundle} from '../helpers/navigation-browser';
let bundle:Awaited<ReturnType<typeof navigationBrowserBundle>>;
test.beforeAll(async()=>{bundle=await navigationBrowserBundle();});
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const items=[{id:id(1),label:'帮助中心',href:'/help-centre'},{id:id(2),label:'Reference 速查',href:'/help-centre/reference'},{id:id(3),label:'异常处理',href:'/help-centre/categories/'+id(100)},{id:id(4),label:'内部表单',href:'/help-centre/forms'}];
const pages=[{type:'group',id:id(100),title:'异常处理',descendants:[{type:'document',id:id(10),title:'提交审核',href:'/help-centre?article='+id(10)}]}];
async function mount(page:Page,extra:Record<string,unknown>={}){const data={pages,quickLinks:{items,currentHref:'/help-centre'},...extra};await page.route('**/__shortcuts_fixture',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="zh-CN" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+bundle.css+'</style></head><body><p>导航本地测试样例 · 非真实公司数据</p><div id="presentation"></div><script type="application/json" id="data">'+JSON.stringify(data).replaceAll('<','\\u003c')+'</script><script>'+bundle.script.replaceAll('</script','<\\/script')+'</script></body></html>'}));await page.goto('/__shortcuts_fixture');}
test('server-filtered shortcuts preserve order, keyboard access, mobile toggle, active page and reader chrome',async({page},info)=>{
 await mount(page);const nav=page.getByRole('navigation',{name:'资料库快捷入口'}),toggle=nav.getByRole('button',{name:/快捷入口/});
 if(info.project.name==='mobile'){await expect(toggle).toHaveAttribute('aria-expanded','false');await expect(nav.getByRole('link',{name:'帮助中心'})).toBeHidden();await toggle.focus();await page.keyboard.press('Enter');await expect(toggle).toHaveAttribute('aria-expanded','true');}
 await expect(nav.getByRole('link')).toHaveText(items.map(x=>x.label));await expect(nav.getByRole('link',{name:'帮助中心'})).toHaveAttribute('aria-current','page');await expect(nav).not.toContainText('OPS');await nav.getByRole('link',{name:'内部表单'}).focus();await expect(nav.getByRole('link',{name:'内部表单'})).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'output/verification/reader-shortcuts-'+info.project.name+'.png',fullPage:true});
 if(info.project.name==='mobile'){await toggle.click();await expect(nav.getByRole('link',{name:'帮助中心'})).toBeHidden();await expect(toggle).toBeFocused();}
 await expect.poll(()=>page.locator('.reader-chrome').evaluate(e=>Number.parseFloat((e.parentElement as HTMLElement).style.getPropertyValue('--reader-chrome-height')))).toBeGreaterThan(80);
});
test('empty and failed shortcut states retain readable article directory and expose no stale links',async({page})=>{
 await mount(page,{quickLinks:{items:[]}});await expect(page.getByText('暂无快捷入口，可从文章目录查阅资料。')).toBeVisible();await expect(page.locator('.reader-shortcuts a')).toHaveCount(0);await expect(page.locator('.reader-layout')).toContainText('提交审核');
 await mount(page,{quickLinks:{items,unavailable:true}});await expect(page.getByRole('status')).toContainText('快捷入口暂时无法加载');await expect(page.locator('.reader-shortcuts a')).toHaveCount(0);await expect(page.getByRole('button',{name:'重新加载',exact:true})).toBeVisible();
});
test('actual menu APIs reject forged role and reader/admin destinations require configured login',async({page,request})=>{
 for(const path of ['/api/admin/navigation','/api/reader-menu']){const r=await request.get(path,{headers:{'x-role':'admin'}});expect([403,503]).toContain(r.status());expect(r.headers()['cache-control']).toBe('private, no-store');expect(r.headers()['vary']).toContain('Authorization');}
 const write=await request.put('/api/admin/navigation',{headers:{origin:'http://127.0.0.1:3210','x-role':'admin'},data:{expectedVersion:0,entries:[]}});expect([403,503]).toContain(write.status());expect(write.headers()['cache-control']).toBe('private, no-store');
 await page.goto('/admin/settings/navigation');await expect(page).toHaveURL(/\/admin\/sign-in/);await page.goto('/help-centre/categories/'+id(100));await expect(page).toHaveURL(/\/sign-in/);
});

test('disabled article feedback and PDF controls are absent while the same article remains readable',async({page})=>{await mount(page,{requested:id(10),article:{id:id(10),title:'提交审核',revision:1,body:'仍可阅读的正式内容'},features:{search:false,pdfExport:false,favorites:false,recent:false,feedback:false,analytics:false,forms:false}});await expect(page.getByRole('heading',{name:'提交审核',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'PDF 阅读／导出'})).toHaveCount(0);await expect(page.locator('.reader-feedback')).toHaveCount(0);await expect(page.getByText('仍可阅读的正式内容')).toBeVisible();});
