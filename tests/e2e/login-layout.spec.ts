import {test,expect} from '@playwright/test';
import {loginBundle} from '../helpers/login-browser';
let bundle:Awaited<ReturnType<typeof loginBundle>>;
test.beforeAll(async()=>{bundle=await loginBundle();});
test.beforeEach(async({page})=>{await page.route('**/login-fixture*',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="zh-CN"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="app"></div></body></html>'}));});
for(const audience of ['employee','admin'])test(`${audience}: fixed redirect, email disclosure, entrance link and mobile layout`,async({page},info)=>{
 await page.goto(`/login-fixture?audience=${audience}&error=1`);await page.addStyleTag({content:bundle.css});await page.addScriptTag({content:bundle.script});
 await expect(page.getByRole('heading',{name:audience==='admin'?'登录内容管理后台':'登录聚域资料库'})).toBeVisible();
 await expect(page.locator('.cl-rootBox')).toHaveAttribute('data-redirect',audience==='admin'?'/admin':'/help-centre');
 await expect(page.locator('.cl-rootBox')).toHaveAttribute('data-signup','false');
 await expect(page.getByRole('link',{name:audience==='admin'?'员工资料库':'管理员登录'})).toHaveAttribute('href',audience==='admin'?'/sign-in':'/admin/sign-in');
 await expect(page.locator('.login-art img')).toHaveAttribute('src',audience==='admin'?'/brand/mascot-admin.webp':'/brand/mascot-employee.webp');
 const mascot=await page.locator('.login-art').boundingBox();
 const form=await page.locator('.login-copy').boundingBox();
 expect(mascot).not.toBeNull();expect(form).not.toBeNull();
 if(info.project.name==='desktop')expect(mascot!.x+mascot!.width).toBeLessThan(form!.x);
 else expect(mascot!.y+mascot!.height).toBeLessThan(form!.y);
 await expect(page.getByRole('textbox',{name:'公司邮箱'})).toBeHidden();await expect(page.getByRole('alert')).toHaveText('登录失败，请重试');
 await page.getByRole('button',{name:'使用邮箱登录'}).click();await expect(page.getByRole('textbox',{name:'公司邮箱'})).toBeVisible();
 await page.getByRole('button',{name:'收起邮箱登录'}).click();await expect(page.getByRole('textbox',{name:'公司邮箱'})).toBeHidden();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`output/verification/login-${audience}-${info.project.name}.png`,fullPage:true});
});
test('continuation forms and service errors remain visible',async({page})=>{
 for(const query of ['step=factor','state=loading','state=failed']){
  await page.goto('/login-fixture?'+query);await page.addStyleTag({content:bundle.css});await page.addScriptTag({content:bundle.script});
  if(query.startsWith('step')){await expect(page.getByText('验证你的账号')).toBeVisible();await expect(page.getByRole('textbox',{name:'公司邮箱'})).toBeVisible();await expect(page.getByRole('button',{name:'使用邮箱登录'})).toHaveCount(0);}
  else{await expect(page.getByRole('link',{name:query.includes('loading')?'连接遇到问题':'查看重试方式'})).toHaveAttribute('href','/sign-in/error');await expect(page.getByRole('button',{name:'使用 Slack 登录'})).toHaveCount(0);}
 }
});

test('both entrances follow the shared theme without hiding recovery or email login',async({page})=>{
 for(const audience of ['employee','admin']){
  await page.goto(`/login-fixture?audience=${audience}&error=1`);await page.addStyleTag({content:bundle.css});await page.addScriptTag({content:bundle.script});
  const theme=page.locator('.login-screen [data-theme-toggle]');
  await expect(theme).toBeVisible();
  await theme.getByRole('button',{name:'Dark',exact:true}).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.locator('.login-screen')).toHaveCSS('background-color','rgb(17, 18, 20)');
  await page.getByRole('button',{name:'使用邮箱登录',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'公司邮箱'})).toBeVisible();
  await theme.getByRole('button',{name:'Light',exact:true}).click();
  await expect(page.locator('.login-screen')).toHaveCSS('background-color','rgb(248, 247, 244)');
  await expect(page.getByRole('textbox',{name:'公司邮箱'})).toBeVisible();
  await expect(page.getByRole('alert')).toHaveText('登录失败，请重试');
  await expect(page.getByRole('link',{name:'登录遇到问题？'})).toHaveAttribute('href',audience==='admin'?'/admin/sign-in/error':'/sign-in/error');
 }
});
