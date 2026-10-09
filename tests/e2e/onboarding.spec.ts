import {readFile} from 'node:fs/promises';
import {test,expect,type Page,type BrowserContext} from '@playwright/test';
import {accountMenuBundle} from '../helpers/account-menu-browser';
let bundle:Awaited<ReturnType<typeof accountMenuBundle>>;
test.beforeAll(async()=>{bundle=await accountMenuBundle();});
// Only Clerk's external persistence is replaced. The menu, prompt and Cult guide are production components.
async function fixture(context:BrowserContext,accounts=new Map<string,Record<string,unknown>>()){
 const writes:{user:string;payload:Record<string,unknown>}[]=[];
 let fail=false,delay=0;
 await context.route('**/__guide-metadata?*',async route=>{
  const user=new URL(route.request().url()).searchParams.get('user')!;
  if(route.request().method()==='PATCH'){
   const payload=route.request().postDataJSON();writes.push({user,payload});
   if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
   if(fail)return route.fulfill({status:503,json:{error:'OFFLINE'}});
   const prior=accounts.get(user)||{};
   const update=payload.unsafeMetadata;
   accounts.set(user,{...prior,...update,juyu_onboarding:{...(prior.juyu_onboarding as object||{}),...update.juyu_onboarding}});
  }
  return route.fulfill({json:{unsafeMetadata:accounts.get(user)||{}}});
 });
 await context.route('**/api/features',route=>route.fulfill({json:{flags:{search:true,pdfExport:true,favorites:true,recent:true,feedback:true,analytics:true,forms:true}}}));
 await context.route('**/__onboarding-fixture*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+bundle.css+(route.request().url().includes('hidden-owner')?'#account{display:none}':'')+'</style></head><body><header class="app-topbar"><strong>JUYU · 本地引导验收</strong><div id="account" style="margin-left:auto"></div></header><div id="account-secondary"></div><main><h1>本地引导验收</h1><button autofocus>继续编辑</button></main><script>'+bundle.script.replace(/<\/script/gi,'<\\/script')+'</script></body></html>'}));
 return {accounts,writes,setFailure:(value:boolean)=>{fail=value;},setDelay:(value:number)=>{delay=value;}};
}
async function open(page:Page,query='reader=1&role=support'){
 await page.goto('/__onboarding-fixture?onboarding=1&'+query);
 await expect(page.getByRole('button',{name:query.includes('lang=en')?'Account menu, Haley QA':'账号菜单, Haley QA',exact:true})).toBeVisible();
}
async function finishEmployee(page:Page){
 await page.getByRole('button',{name:'开始引导',exact:true}).click();
 const guide=page.getByRole('dialog',{name:'员工使用指南',exact:true});
 await expect(guide.getByRole('heading',{name:'按分类找资料',exact:true})).toBeVisible();
 await guide.getByRole('button',{name:'下一步',exact:true}).click();
 await expect(guide.getByRole('heading',{name:'搜索资料',exact:true})).toBeVisible();
 await guide.getByRole('button',{name:'下一步',exact:true}).click();
 await guide.getByRole('button',{name:'开始使用',exact:true}).click();
 await expect(guide).toHaveCount(0);
}

test('first employee visit offers a non-blocking guide, completion survives reload and manual replay stays available',async({page,context,browser})=>{
 const state=await fixture(context);state.accounts.set('user_local_qa',{personal_note:'keep'});
 await open(page);const prompt=page.getByRole('region',{name:'员工新手引导',exact:true});await expect(prompt).toBeVisible();
 await expect(page.getByRole('button',{name:'继续编辑',exact:true})).toBeFocused();
 await finishEmployee(page);
 expect(state.writes).toEqual([{user:'user_local_qa',payload:{unsafeMetadata:{juyu_onboarding:{employee:{version:1,status:'completed'}}}}}]);
 expect(state.accounts.get('user_local_qa')).toEqual({personal_note:'keep',juyu_onboarding:{employee:{version:1,status:'completed'}}});
 await page.reload();await expect(page.getByRole('button',{name:'账号菜单, Haley QA',exact:true})).toBeVisible();await expect(prompt).toHaveCount(0);
 await page.getByRole('button',{name:'账号菜单, Haley QA',exact:true}).click();await page.getByRole('menuitem',{name:'使用指南',exact:true}).click();
 const guide=page.getByRole('dialog',{name:'员工使用指南',exact:true});await expect(guide).toBeVisible();await page.keyboard.press('Escape');await expect(guide).toHaveCount(0);expect(state.writes).toHaveLength(1);
 const other=await browser.newContext();try{await fixture(other,state.accounts);const device=await other.newPage();await open(device);await expect(device.getByRole('region',{name:'员工新手引导',exact:true})).toHaveCount(0);}finally{await other.close();}
});

test('employee and admin acknowledgements stay independent and another account is offered its own guide',async({page,context})=>{
 const state=await fixture(context);state.accounts.set('user_local_qa',{juyu_onboarding:{employee:{version:1,status:'completed'}}});
 await open(page,'role=super_admin');const prompt=page.getByRole('region',{name:'后台新手引导',exact:true});await expect(prompt).toBeVisible();
 await prompt.getByRole('button',{name:'暂时跳过',exact:true}).click();await expect(prompt).toHaveCount(0);
 expect(state.writes[0]).toEqual({user:'user_local_qa',payload:{unsafeMetadata:{juyu_onboarding:{admin:{version:1,status:'skipped'}}}}});
 expect(state.accounts.get('user_local_qa')).toEqual({juyu_onboarding:{employee:{version:1,status:'completed'},admin:{version:1,status:'skipped'}}});
 await page.reload();await expect(page.getByRole('button',{name:'账号菜单, Haley QA',exact:true})).toBeVisible();await expect(prompt).toHaveCount(0);
 await open(page,'role=super_admin&user=user_another');await expect(prompt).toBeVisible();
});

test('failed completion stays visible, retry records it once and a pending save cannot be double-submitted',async({page,context})=>{
 const state=await fixture(context);await open(page);await page.getByRole('button',{name:'开始引导',exact:true}).click();const guide=page.getByRole('dialog',{name:'员工使用指南',exact:true});
 await guide.getByRole('button',{name:'下一步',exact:true}).click();await guide.getByRole('button',{name:'下一步',exact:true}).click();
 state.setFailure(true);await guide.getByRole('button',{name:'开始使用',exact:true}).click();await expect(guide.getByRole('alert')).toContainText('未能保存引导状态');await expect(guide).toBeVisible();expect(state.accounts.has('user_local_qa')).toBe(false);
 state.setFailure(false);state.setDelay(300);await guide.getByRole('button',{name:'重试保存',exact:true}).click();await expect(guide.getByRole('button',{name:'开始使用',exact:true})).toBeDisabled();await expect(guide).toHaveCount(0);expect(state.writes).toHaveLength(2);
 await page.reload();await expect(page.getByRole('button',{name:'账号菜单, Haley QA',exact:true})).toBeVisible();await expect(page.getByRole('region',{name:'员工新手引导',exact:true})).toHaveCount(0);
});

test('failed skipping can be dismissed for this tab without claiming the account was saved',async({page,context})=>{
 const state=await fixture(context);state.setFailure(true);await open(page);const prompt=page.getByRole('region',{name:'员工新手引导',exact:true});
 await prompt.getByRole('button',{name:'暂时跳过',exact:true}).click();await expect(prompt.getByRole('alert')).toContainText('未能保存引导状态');
 await prompt.getByRole('button',{name:'本次先关闭',exact:true}).click();await expect(prompt).toHaveCount(0);expect(state.accounts.has('user_local_qa')).toBe(false);
 await page.reload();await expect(page.getByRole('button',{name:'账号菜单, Haley QA',exact:true})).toBeVisible();await expect(prompt).toHaveCount(0);
 await open(page,'reader=1&role=support&user=user_another');await expect(prompt).toBeVisible();
});

test('closing an unfinished first guide saves skipped and manual completion can upgrade it',async({page,context})=>{
 const state=await fixture(context);await open(page);await page.getByRole('button',{name:'开始引导',exact:true}).click();const guide=page.getByRole('dialog',{name:'员工使用指南',exact:true});
 await page.keyboard.press('Escape');await expect(guide).toHaveCount(0);expect(state.writes[0].payload).toEqual({unsafeMetadata:{juyu_onboarding:{employee:{version:1,status:'skipped'}}}});
 await page.reload();await expect(page.getByRole('button',{name:'账号菜单, Haley QA',exact:true})).toBeVisible();await expect(page.getByRole('region',{name:'员工新手引导',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'账号菜单, Haley QA',exact:true}).click();await page.getByRole('menuitem',{name:'使用指南',exact:true}).click();
 await guide.getByRole('button',{name:'下一步',exact:true}).click();await guide.getByRole('button',{name:'下一步',exact:true}).click();await guide.getByRole('button',{name:'开始使用',exact:true}).click();await expect(guide).toHaveCount(0);
 expect(state.writes[1].payload).toEqual({unsafeMetadata:{juyu_onboarding:{employee:{version:1,status:'completed'}}}});
});

test('unavailable or signed-out identities never receive an automatic guide',async({page,context})=>{
 const state=await fixture(context);
 for(const query of ['signed-out=1','loading=1','unconfigured=1','role=support']){
  await page.goto('/__onboarding-fixture?onboarding=1&'+query);await expect(page.getByRole('heading',{name:'本地引导验收',exact:true})).toBeVisible();await expect(page.getByRole('region',{name:/新手引导/})).toHaveCount(0);
 }
 expect(state.writes).toEqual([]);
});

test('first guide navigation respects unsaved-editor protection without recording a skipped guide',async({page,context})=>{
 const state=await fixture(context);await open(page,'role=super_admin&guard=1');await page.getByRole('button',{name:'开始引导',exact:true}).click();const guide=page.getByRole('dialog',{name:'后台使用指南',exact:true});
 await guide.getByRole('link',{name:'打开内容管理 ↗',exact:true}).click();await expect(guide).toBeVisible();await expect(page).toHaveURL(/__onboarding-fixture/);expect(state.writes).toEqual([]);
});

test('a stalled preference save times out and leaves an actionable dismissal',async({page,context})=>{
 const state=await fixture(context);await page.clock.install();let release=async()=>{};
 await context.route('**/__guide-metadata?*',route=>{if(route.request().method()==='PATCH'){release=()=>route.abort();return;}return route.fallback();});
 await open(page);const prompt=page.getByRole('region',{name:'员工新手引导',exact:true});await prompt.getByRole('button',{name:'暂时跳过',exact:true}).click();await expect(prompt.getByRole('status')).toBeVisible();
 await page.clock.fastForward(10001);await expect(prompt.getByRole('alert')).toContainText('未能保存引导状态');await prompt.getByRole('button',{name:'本次先关闭',exact:true}).click();await expect(prompt).toHaveCount(0);expect(state.accounts.has('user_local_qa')).toBe(false);await release();
});

test('a malformed acknowledgement is not treated as completed',async({page,context})=>{
 const state=await fixture(context);state.accounts.set('user_local_qa',{juyu_onboarding:{employee:{version:1,status:'unknown'}}});await open(page);await expect(page.getByRole('region',{name:'员工新手引导',exact:true})).toBeVisible();
});

test('English first-visit prompt stays inside the viewport and has accessible controls in dark mode',async({page,context})=>{
 await fixture(context);await open(page,'reader=1&role=support&lang=en');await page.evaluate(()=>document.documentElement.classList.add('dark'));const prompt=page.getByRole('region',{name:'Employee onboarding',exact:true});await expect(prompt).toBeVisible();
 const bounds=await prompt.boundingBox();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.y).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(await page.evaluate(()=>innerWidth));expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(await page.evaluate(()=>innerHeight));
 await page.addScriptTag({content:await readFile('node_modules/axe-core/axe.min.js','utf8')});
 const result=await page.evaluate(async()=>await (window as unknown as {axe:{run(context:unknown,options:unknown):Promise<{violations:{id:string}[]}>}}).axe.run('[role="region"]',{runOnly:['aria-allowed-attr','aria-required-children','aria-required-parent','button-name','color-contrast']}));expect(result.violations.map(v=>v.id)).toEqual([]);
 await prompt.getByRole('button',{name:'Start guide',exact:true}).click();await expect(page.getByRole('dialog',{name:'Employee usage guide',exact:true})).toBeVisible();
});

test('collapsed reader account controls cannot hide the first-visit prompt or guide',async({page,context})=>{
 await fixture(context);await page.goto('/__onboarding-fixture?onboarding=1&reader=1&role=support&hidden-owner=1');
 const prompt=page.getByRole('region',{name:'员工新手引导',exact:true});await expect(prompt).toBeVisible();await prompt.getByRole('button',{name:'开始引导',exact:true}).click();await expect(page.getByRole('dialog',{name:'员工使用指南',exact:true})).toBeVisible();
});

test('multiple responsive account controls offer one shared first-visit prompt',async({page,context})=>{
 const state=await fixture(context);await page.goto('/__onboarding-fixture?onboarding=1&reader=1&role=support&duplicate=1');
 const prompt=page.getByRole('region',{name:'员工新手引导',exact:true});await expect(prompt).toHaveCount(1);await prompt.getByRole('button',{name:'暂时跳过',exact:true}).click();await expect(prompt).toHaveCount(0);expect(state.writes).toHaveLength(1);
});
