import test from 'node:test';
import assert from 'node:assert/strict';
import {loadComponent} from './helpers/render-component.ts';
const input={items:[{documentId:'test-only',expectedSequence:1,revision:1,publishedRevision:null}]};
test('batch endpoint authenticates before work and enforces origin, bounded JSON and no extra query',async()=>{
 let writes=0,allowed=true;const saved=process.env.APP_ORIGIN;process.env.APP_ORIGIN='https://juyu.test';
 try{const {POST}=loadComponent('src/app/api/admin/review/bulk-withdraw/route.ts',{'../../../../../server/authorization/application':{applicationAuthorization:async()=>({requireEditorAdmin:async()=>{if(!allowed)throw new Error('FORBIDDEN');},withdrawReviews:async(value:unknown)=>{writes++;assert.deepEqual(value,input);return {items:[]};}})}});
 const send=POST as (r:Request)=>Promise<Response>;const make=(url='https://juyu.test/api/admin/review/bulk-withdraw',headers:Record<string,string>={'content-type':'application/json',origin:'https://juyu.test'},body=JSON.stringify(input))=>new Request(url,{method:'POST',headers,body});
 assert.equal((await send(make())).status,200);assert.equal(writes,1);
 for(const request of [make(undefined,{'content-type':'application/json',origin:'https://evil.test'}),make(undefined,{'content-type':'text/plain',origin:'https://juyu.test'}),make('https://juyu.test/api/admin/review/bulk-withdraw?actor=admin'),make(undefined,undefined,'{'),make(undefined,undefined,'x'.repeat(17000))]){const response=await send(request);assert.ok([400,403,413].includes(response.status));assert.equal(response.headers.get('cache-control'),'private, no-store');}
 assert.equal(writes,1);allowed=false;assert.equal((await send(make())).status,403);assert.equal(writes,1);
 }finally{if(saved===undefined)delete process.env.APP_ORIGIN;else process.env.APP_ORIGIN=saved;}
});
