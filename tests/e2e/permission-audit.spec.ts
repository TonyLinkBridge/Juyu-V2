import {expect,test} from '@playwright/test';
import {readdir,readFile} from 'node:fs/promises';
import {join,relative} from 'node:path';

const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const claims={cookie:'__session=forged; role=admin',authorization:'Bearer forged','x-role':'admin','x-clerk-auth-status':'signed-in','x-clerk-auth-user-id':'forged-admin','x-middleware-subrequest':'proxy:proxy:proxy:proxy:proxy',origin:'http://127.0.0.1:3210'};
async function files(directory:string):Promise<string[]>{const result:string[]=[];for(const entry of await readdir(directory,{withFileTypes:true})){const p=join(directory,entry.name);if(entry.isDirectory())result.push(...await files(p));else result.push(p);}return result.sort();}
function pathFor(file:string){return '/'+relative('src/app',file).split('\\').join('/').replace(/\/(route|page)\.tsx?$/,'').replace('[revision]','1').replace(/\[[^\]]+\]/g,id);}

// Inventory comes from the actual application tree: a new business route cannot
// silently escape this sweep. This tests the real UNCONFIGURED app, not Clerk login.
test('T055 every business HTTP method rejects forged identity and conditional-cache requests',async({request},info)=>{
 test.setTimeout(60000);const checked:{path:string;method:string;status:number}[]=[];
 for(const file of await files('src/app/api')){
  if(!file.endsWith('/route.ts'))continue;const path=pathFor(file);
  if(['/api/health','/api/readiness','/api/auth/company'].includes(path))continue;
  const source=await readFile(file,'utf8');const methods=[...source.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD)\b/g)].map(x=>x[1]);
  expect(methods.length,`No recognized methods: ${file}`).toBeGreaterThan(0);
  for(const method of [...methods,...(methods.includes('GET')&&!methods.includes('HEAD')?['HEAD']:[])]){
   const query=(method==='GET'||method==='HEAD')?(path===`/api/favorites/${id}`?'?revision=1':path==='/api/search'?'?q=account':''):'';
   const url=path+query;
   const response=await request.fetch(url,{method,maxRedirects:0,headers:{...claims,'if-none-match':'"forged-cache"','if-modified-since':'Wed, 01 Jan 2099 00:00:00 GMT'},...(method==='GET'||method==='HEAD'?{}:{data:{role:'admin',memberId:'forged-admin',companyVerified:true}})});
   expect(response.status(),method+' '+path).toBe(503);expect(response.headers()['cache-control'],path).toContain('no-store');
   if(method==='HEAD')expect(await response.body(),path).toHaveLength(0);else{const body=await response.json();expect(Object.keys(body),path).toEqual(['error']);expect(/^(AUTH_NOT_CONFIGURED|[A-Z_]+_UNAVAILABLE)$/.test(body.error)||(path.endsWith('/diagram')&&body.error==='流程图不可读取。')||(path==='/api/admin/workspace'&&body.error==='内容暂时无法读取，请稍后重试。'),path).toBe(true);}checked.push({path,method,status:response.status()});
  }
 }
 expect(checked.length).toBeGreaterThan(80);await info.attach('business-route-matrix',{body:JSON.stringify(checked,null,2),contentType:'application/json'});
});

test('T055 all protected pages reject direct URLs and forged admin query parameters',async({request,page},info)=>{
 test.setTimeout(60000);const checked:string[]=[];
 for(const file of await files('src/app')){
  if(!file.endsWith('/page.tsx'))continue;const path=pathFor(file);
  if(!/^\/(admin|help-centre)(\/|$)/.test(path)||path.startsWith('/admin/sign-in')||path==='/admin/access-denied')continue;
  const response=await request.get(path+'?role=admin&companyVerified=true&article='+id,{headers:claims,maxRedirects:0});
  expect([200,307],path).toContain(response.status());expect(response.headers()['cache-control'],path).toContain('no-store');
  // Next may send redirects inside a streamed 200 response; follow it in a real browser.
  await page.setExtraHTTPHeaders(claims);await page.goto(path+'?role=admin&companyVerified=true&article='+id);await expect(page).toHaveURL(new RegExp(path.startsWith('/admin')?'/admin/sign-in$':'/sign-in$'));checked.push(path);
 }
 expect(checked.length).toBeGreaterThan(30);await info.attach('protected-page-matrix',{body:JSON.stringify(checked,null,2),contentType:'application/json'});
});

test('T055 image optimizer cannot fetch or cache protected thumbnails, media or historical images',async({request})=>{
 for(const target of [`/api/assets/${id}`,`/api/admin/assets/${id}`,`/api/admin/history/${id}/versions/1/assets/${id}`,`/api/articles/${id}/pdf?revision=1`,'/api/health','https://example.invalid/private.png']){
  for(const headers of [{},claims]){
   const response=await request.get('/_next/image?'+new URLSearchParams({url:target,w:'640',q:'75'}),{headers});
   expect(response.status()).toBe(400);expect(await response.text()).toBe('"url" parameter is not allowed');
   expect(response.headers()['x-nextjs-cache']).toBeUndefined();
  }
 }
});
