import assert from 'node:assert/strict';
import {test} from 'node:test';
import {navigationPage,selectNavigationPage} from '../src/reader/navigation.ts';

test('navigation URLs keep opaque identifiers inside a local query parameter',()=>{
 const page=navigationPage({id:'../运营?role=admin&#标题',title:'公开标题'});
 const url=new URL(page.href,'https://internal.example');
 assert.equal(url.pathname,'/help-centre');
 assert.equal(url.searchParams.get('article'),'../运营?role=admin&#标题');
 assert.deepEqual([...url.searchParams.keys()],['article']);
 assert.equal(url.hash,'');
});
test('selection uses exact authorized IDs and never defaults an unavailable request to another page',()=>{
 const pages=[navigationPage({id:'a',title:'甲'}),navigationPage({id:'a-long',title:'乙'})];
 assert.equal(selectNavigationPage(pages,'a-long')?.id,'a-long');
 assert.equal(selectNavigationPage(pages,'hidden'),null);
 assert.equal(selectNavigationPage(pages,undefined),null);
 assert.equal(selectNavigationPage(pages,['a','a-long']),null);
});
test('unconfigured navigation endpoint ignores forged claims and prevents shared caching',async()=>{
 const {GET}=await import('../src/app/api/navigation/route.ts');
 const response=await GET(new Request('http://localhost/api/navigation?role=admin',{headers:{'x-role':'admin',cookie:'role=admin'}}));
 assert.equal(response.status,503);
 assert.equal(response.headers.get('cache-control'),'private, no-store');
 assert.deepEqual(await response.json(),{error:'AUTH_NOT_CONFIGURED'});
});
