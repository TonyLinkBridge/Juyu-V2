import {test,expect} from '@playwright/test';
test('real history endpoints keep unconfigured and forged identities outside private records',async({page,request})=>{
 const id='00000000-0000-4000-8000-000000000039',base=`/api/admin/history/${id}`,headers={'x-role':'admin','x-user-id':'admin-a'};
 for(const path of [base,`${base}/versions/1`,`${base}/versions/1/assets/00000000-0000-4000-8000-000000000001`]){const response=await request.get(path,{headers});expect(response.status()).toBe(503);expect(response.headers()['cache-control']).toBe('private, no-store');expect(response.headers()['vary']).toContain('Cookie');}
 for(const [path,data] of [[`${base}/versions/1`,{expectedSequence:0,sourceRevision:1}],[`${base}/versions/1/diagram`,{source:'flowchart LR; A-->B'}]] as const){const response=await request.post(path,{headers,data});expect(response.status()).toBe(503);expect(response.headers()['cache-control']).toBe('private, no-store');}
 for(const path of ['/admin/history',`/admin/history?article=${id}`,`/admin/history?article=${id}&revision=1`]){await page.goto(path);await expect(page).toHaveURL(/\/admin\/sign-in$/);await expect(page.getByRole('button',{name:'恢复为新草稿',exact:true})).toHaveCount(0);}
});
