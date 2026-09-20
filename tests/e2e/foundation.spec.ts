import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('website opens employee login directly without an admin chooser', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole('heading', { name: '登录聚域资料库' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('尚未连接');
  await expect(page.getByRole('status')).toContainText('登录服务尚未连接');await expect(page.getByRole('button',{name:/Slack|登录/})).toHaveCount(0);
  await expect(page.getByRole('link', { name: '进入员工资料库' })).toHaveCount(0);
  await expect(page.getByRole('link',{name:'管理员登录 ↗'})).toHaveAttribute('href','/admin/sign-in');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await mkdir('output/verification', { recursive: true });
  await page.screenshot({ path: `output/verification/entry-flow-${testInfo.project.name}-login.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test('admin entry and forged role parameters never grant access', async ({ page }, testInfo) => {
  await page.goto('/admin?role=admin&demo=1');
  await expect(page).toHaveURL(/\/admin\/sign-in$/);
  await expect(page.getByRole('heading', { name: '登录内容管理后台' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('登录服务尚未连接');await expect(page.getByRole('button',{name:/Slack|登录/})).toHaveCount(0);
  await expect(page.getByText('创建文章', { exact: true })).toHaveCount(0);
  await mkdir('output/verification', { recursive: true });
  await page.screenshot({ path: `output/verification/entry-flow-${testInfo.project.name}-admin.png`, fullPage: true });
  await page.getByRole('link', { name: '返回员工登录 ↗' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/sign-in$/);
});

test('unknown routes show a recovery link and remain 404', async ({ page }) => {
  const response = await page.goto('/does-not-exist');
  expect(response?.status()).toBe(404);
  await page.getByRole('link', { name: '返回入口' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test('health means process alive while readiness stays unavailable and uncached', async ({ request }) => {
  const health = await request.get('/api/health');
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ status: 'ok', scope: 'web_process_only',release:expect.any(String) });
  const readiness = await request.get('/api/readiness');
  expect(readiness.status()).toBe(503);
  expect(readiness.headers()['cache-control']).toContain('no-store');
  const body = await readiness.json();
  expect(body.status).toBe('not_ready');
  expect(body.authentication).toBe('not_checked');
  expect(body.database).toBe('not_checked');
  expect(body.checkedAt).toEqual(expect.any(String));expect(body.release).toEqual(expect.any(String));expect(body.loginVerified).toBe(false);
});


test('login recovery is local, accessible and never echoes URL error details', async ({ page }) => {
  const response = await page.goto('/sign-in/error?message=private-secret&redirect_url=https://example.org');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: '登录遇到问题' })).toBeVisible();
  await expect(page.getByText('private-secret')).toHaveCount(0);
  await expect(page.locator('a[href^="/admin"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.getByRole('link', { name: '重新尝试登录' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test('Clerk catch-all and employee entry remain closed without keys, ignoring forged session and return URLs', async ({ page, request }) => {
  await page.goto('/sign-in/sso-callback?redirect_url=https://example.org&role=admin');
  await expect(page.getByRole('heading', { name: '登录聚域资料库' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('登录服务尚未连接');await expect(page.getByRole('button',{name:/Slack|登录/})).toHaveCount(0);
  const response = await request.get('/help-centre?returnTo=https://example.org&role=admin', {
    maxRedirects: 0,
    headers: { Cookie: '__session=forged; role=admin', 'X-Clerk-Auth-Status': 'signed-in', 'X-Clerk-Auth-User-Id': 'user_forged' },
  });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe('/sign-in');
  expect(response.headers()['cache-control']).toContain('no-store');
});


test('company check ignores forged identity and metadata and never grants data access without configuration', async ({ request }) => {
  const response = await request.get('/api/auth/company?slackTeamId=T12345678&slackVerifiedAt=2099-01-01&role=admin', {
    headers: { Cookie: '__session=forged; role=admin', Authorization: 'Bearer forged', 'X-Clerk-Auth-User-Id': 'user_forged', 'X-Clerk-Auth-Status': 'signed-in' },
  });
  expect(response.status()).toBe(503);
  expect(response.headers()['cache-control']).toContain('no-store');
  expect(await response.json()).toEqual({ status: 'unconfigured', contentAccess: 'not_configured' });
});


test('admin callbacks and protected APIs remain closed without real identity configuration', async ({ page, request }) => {
  await page.goto('/admin/sign-in/sso-callback?redirect_url=https://example.org&role=admin');
  await expect(page.getByRole('heading', { name: '登录内容管理后台' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('登录服务尚未连接');await expect(page.getByRole('button',{name:/Slack|登录/})).toHaveCount(0);
  for (const path of ['/api/admin/access', '/api/admin/articles/private']) {
    const response = await request.get(path + '?role=admin&companyVerified=true', { headers: { Cookie: '__session=forged; role=admin', Authorization: 'Bearer forged', 'X-Clerk-Auth-User-Id': 'user_admin', 'X-Clerk-Auth-Status': 'signed-in' } });
    expect(response.status()).toBe(503);
    expect(response.headers()['cache-control']).toContain('no-store');
    expect(await response.json()).toEqual({ error: 'AUTH_NOT_CONFIGURED' });
  }
});

test('admin recovery stays on its login and denial screen exposes no backend content', async ({ page }, testInfo) => {
  await page.goto('/admin/sign-in/error?message=private-secret&returnTo=https://example.org');
  await expect(page.getByRole('heading', { name: '登录遇到问题' })).toBeVisible();
  await expect(page.getByText('private-secret')).toHaveCount(0);
  await page.getByRole('link', { name: '重新尝试登录' }).click();
  await expect(page).toHaveURL(/\/admin\/sign-in$/);
  await page.goto('/admin/access-denied?role=admin');
  await expect(page.getByRole('heading', { name: '没有后台访问权限' })).toBeVisible();
  await expect(page.getByText('创建文章', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.screenshot({ path: `output/verification/admin-denied-${testInfo.project.name}.png`, fullPage: true });
  await page.getByRole('link', { name: '返回员工资料库' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});


test('Clerk redirect query overrides are removed before employee or admin callbacks run', async ({ request }) => {
  for (const base of ['/sign-in', '/admin/sign-in']) {
    const params = new URLSearchParams({ state: 'keep', code: 'keep', __clerk_ticket: 'keep', sign_in_force_redirect_url: '/sign-in/error', sign_up_force_redirect_url: 'https://example.org', sign_in_fallback_redirect_url: '/other', sign_up_fallback_redirect_url: '/other', redirect_url: '//example.org' });
    const response = await request.get(`${base}/sso-callback?${params}`, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()['cache-control']).toContain('no-store');
    const target = new URL(response.headers().location, 'http://127.0.0.1:3210');
    expect(target.origin).toBe('http://127.0.0.1:3210');
    expect(target.pathname).toBe(`${base}/sso-callback`);
    expect(Object.fromEntries(target.searchParams)).toEqual({ state: 'keep', code: 'keep', __clerk_ticket: 'keep' });
  }
});

test('member management is closed without configuration even with forged roles and write payloads',async({page,request})=>{
 await page.goto('/admin/members?role=admin');await expect(page).toHaveURL(/\/admin\/sign-in$/);
 for(const method of ['get','patch','post'] as const){
  const path=method==='get'?'/api/admin/members':method==='patch'?'/api/admin/members/forged':'/api/admin/members/operations/00000000-0000-0000-0000-000000000000';
  const response=await request[method](path,{headers:{Cookie:'__session=forged; role=admin',Origin:'http://127.0.0.1:3210'},...(method!=='get'?{data:{type:'role',role:'admin',expectedRole:'support'}}:{})});
  expect(response.status()).toBe(503);expect(response.headers()['cache-control']).toContain('no-store');expect(await response.json()).toEqual({error:'AUTH_NOT_CONFIGURED'});
 }
});

test('enrollment endpoints reject unconfigured or forged identities without initializing a user',async({request})=>{
 for(const method of ['get','post'] as const){
  const response=await request[method]('/api/auth/enrollment?role=admin',{headers:{Cookie:'__session=forged; role=admin',Origin:'http://127.0.0.1:3210'},...(method==='post'?{data:{userId:'forged',role:'admin'}}:{})});
  expect(response.status()).toBe(503);expect(response.headers()['cache-control']).toContain('no-store');expect(await response.json()).toEqual({error:'AUTH_NOT_CONFIGURED'});
 }
});

test('reader navigation remains protected without identity configuration despite forged roles',async({page,request})=>{
 const response=await request.get('/api/navigation?role=admin',{headers:{'x-role':'admin',cookie:'role=admin'}});
 expect(response.status()).toBe(503);
 expect(response.headers()['cache-control']).toBe('private, no-store');
 expect(await response.json()).toEqual({error:'AUTH_NOT_CONFIGURED'});
 await page.goto('/help-centre?article=private&role=admin');
 await expect(page).toHaveURL(/\/sign-in$/);
 await expect(page.getByRole('navigation',{name:'文章目录'})).toHaveCount(0);
});


test('search page rejects forged identity and never exposes results before login',async({page,request})=>{
 const response=await request.get('/help-centre?q=private&role=admin',{maxRedirects:0,headers:{Cookie:'__session=forged; role=admin','X-Clerk-Auth-Status':'signed-in','X-Clerk-Auth-User-Id':'user_admin'}});
 expect(response.status()).toBe(307);expect(response.headers().location).toBe('/sign-in');expect(response.headers()['cache-control']).toContain('no-store');
 await page.goto('/help-centre?q=private&role=admin');await expect(page).toHaveURL(/\/sign-in$/);await expect(page.getByRole('search')).toHaveCount(0);await expect(page.getByRole('list',{name:'搜索结果列表'})).toHaveCount(0);
});

test('feedback endpoints and admin page reject forged identities without configuration',async({page,request})=>{
 await page.goto('/admin/feedback?role=admin');await expect(page).toHaveURL(/\/admin\/sign-in$/);
 for(const path of ['/api/articles/private/feedback?revision=1&role=admin','/api/admin/feedback?role=admin','/api/admin/feedback?document=private&revision=1']){
  const response=await request.get(path,{headers:{Cookie:'__session=forged; role=admin','X-Clerk-Auth-User-Id':'user_admin'}});
  expect(response.status()).toBe(503);expect(response.headers()['cache-control']).toContain('no-store');expect(await response.json()).toEqual({error:'AUTH_NOT_CONFIGURED'});
 }
 const response=await request.put('/api/articles/private/feedback',{headers:{Cookie:'__session=forged; role=admin',Origin:'http://127.0.0.1:3210'},data:{revision:1,helpful:true,comment:'forged',expectedVersion:0,memberId:'user_admin'}});
 expect(response.status()).toBe(503);expect(response.headers()['cache-control']).toContain('no-store');expect(await response.json()).toEqual({error:'AUTH_NOT_CONFIGURED'});
});

test('PDF pages, print checks and downloads remain closed without genuine identity configuration',async({page,request})=>{
 await page.goto('/help-centre/pdf?article=private&revision=1&role=admin');await expect(page).toHaveURL(/\/sign-in$/);
 for(const suffix of ['','&check=1','&download=1']){
 const response=await request.get('/api/articles/private/pdf?revision=1&role=admin'+suffix,{headers:{cookie:'__session=forged; role=admin','X-Clerk-Auth-User-Id':'admin'}});expect(response.status()).toBe(503);expect(response.headers()['cache-control']).toContain('no-store');expect(await response.json()).toEqual({error:'AUTH_NOT_CONFIGURED'});
 }
});

test('media editor, upload, draft assets and changes reject forged identity before configuration',async({page,request})=>{
 await page.goto('/admin/media?article=private&role=admin');await expect(page).toHaveURL(/\/admin\/sign-in$/);
 for(const path of ['/api/admin/media/private','/api/admin/assets/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']){const r=await request.get(path,{headers:{cookie:'role=admin; __session=forged'}});expect(r.status()).toBe(503);expect(r.headers()['cache-control']).toContain('no-store');expect(await r.json()).toEqual({error:'AUTH_NOT_CONFIGURED'});}
 for(const method of ['patch','post'] as const){const r=await request[method]('/api/admin/media/private'+(method==='post'?'/upload':''),{headers:{cookie:'__session=forged',origin:'http://127.0.0.1:3210'},data:method==='patch'?{expectedSequence:0,blocks:[],role:'admin'}:'fake'});expect(r.status()).toBe(503);expect(await r.json()).toEqual({error:'AUTH_NOT_CONFIGURED'});}
});
