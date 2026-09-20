import assert from 'node:assert/strict';
import {test} from 'node:test';
import {searchDialogResponse} from '../src/server/search/dialog-http.ts';
import type {TitleSearch} from '../src/reader/search.ts';
import {parseSearchScope,searchHref} from '../src/reader/search.ts';

test('search dialog returns only authorized search projection and private no-store headers',async()=>{
 const result:TitleSearch={status:'ready',query:'域名',total:1,page:1,pages:1,results:[{id:'one',title:'域名规则',href:'/help-centre?article=one',breadcrumbs:['账户'],kind:'article',snippet:'正文'}]};
 const response=await searchDialogResponse(new URL('https://local/api/search?q=%E5%9F%9F%E5%90%8D'),async(query)=>{assert.equal(query,'域名');return result;});
 assert.equal(response.status,200);
 assert.equal(response.headers.get('cache-control'),'private, no-store');
 assert.equal(response.headers.get('vary'),'Cookie, Authorization');
 assert.deepEqual(await response.json(),result);
});

test('search dialog rejects malformed input before querying and hides backend errors',async()=>{
 let calls=0;
 const bad=await searchDialogResponse(new URL('https://local/api/search?q=a&q=b'),async()=>{calls++;throw new Error('should not query');});
 assert.equal(bad.status,400);assert.equal(calls,0);
 const failed=await searchDialogResponse(new URL('https://local/api/search?q=x'),async()=>{throw new Error('sensitive database detail');});
 assert.equal(failed.status,503);assert.deepEqual(await failed.json(),{error:'SEARCH_UNAVAILABLE'});
});

test('search scope is validated and retained in dialog and pagination links',async()=>{
 assert.equal(parseSearchScope(undefined),'all');
 assert.equal(parseSearchScope('qa'),'qa');
 assert.equal(parseSearchScope('wrong'),null);
 assert.equal(parseSearchScope(['qa','ops']),null);
 assert.equal(searchHref('域名',2,'qa'),'/help-centre?q=%E5%9F%9F%E5%90%8D&page=2&scope=qa');
 const result:TitleSearch={status:'ready',query:'域名',total:0,page:1,pages:0,results:[]};
 const response=await searchDialogResponse(new URL('https://local/api/search?q=%E5%9F%9F%E5%90%8D&scope=qa'),async(query,scope)=>{assert.equal(query,'域名');assert.equal(scope,'qa');return result;});
 assert.equal(response.status,200);
 const bad=await searchDialogResponse(new URL('https://local/api/search?q=x&scope=wrong'),async()=>{throw new Error('called');});
 assert.equal(bad.status,400);
});
