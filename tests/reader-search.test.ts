import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseSearchQuery,searchTitles,searchHref} from '../src/reader/search.ts';
import type {NavigationNode} from '../src/reader/tree.ts';
const document=(id:string,title:string):NavigationNode=>({type:'document',id,title,href:`/help-centre?article=${id}`});
test('search input rejects ambiguous and long values, preserving a usable empty state',()=>{
 assert.deepEqual(parseSearchQuery(undefined),{status:'empty',query:''});
 assert.deepEqual(parseSearchQuery('　  '),{status:'empty',query:''});
 assert.deepEqual(parseSearchQuery(' 域名  转出 '),{status:'ready',query:'域名 转出'});
 assert.equal(parseSearchQuery(['ops','staff']).status,'invalid');
 assert.equal(parseSearchQuery('a'.repeat(121)).status,'invalid');
 assert.equal(parseSearchQuery('a\u0000b').status,'invalid');
});
test('title matching is literal, Chinese capable and deduplicated with only permitted breadcrumb data',()=>{
 const items:NavigationNode[]=[{type:'group',id:'group',title:'业务资料',descendants:[document('one','域名转出 EPP 操作'),document('two','费用 100%_ 说明')]},document('one','域名转出 EPP 操作')];
 const result=searchTitles(items,'域名 epp');
 assert.equal(result.status,'ready');assert.equal(result.total,1);
 assert.deepEqual(result.results,[{id:'one',title:'域名转出 EPP 操作',href:'/help-centre?article=one',breadcrumbs:['业务资料']}]);
 assert.equal(searchTitles(items,'%_').total,1);assert.equal(searchTitles(items,'[').total,0);
 assert.equal(searchTitles(items,'secret body').total,0);assert.equal(searchTitles(items,'').total,0);
});
test('bounded pages preserve total and make invalid/out of range pages recoverable',()=>{
 const items=Array.from({length:45},(_,i)=>document(String(i),'域名 '+i));
 const result=searchTitles(items,'域名','2');
 assert.equal(result.total,45);assert.equal(result.results.length,20);assert.equal(result.results[0].id,'20');assert.equal(result.pages,3);
 assert.equal(searchTitles(items,'域名','3').results.length,5);
 assert.equal(searchTitles(items,'域名','4').results.length,0);
 assert.equal(searchTitles(items,'域名',['1','2']).status,'invalid');
 assert.equal(searchTitles(items,'域名','-1').status,'invalid');
 assert.equal(searchTitles(items,'域名','1e9').status,'invalid');
 const url=new URL(searchHref('域名 & # /',2),'http://local');assert.equal(url.searchParams.get('q'),'域名 & # /');assert.equal(url.searchParams.get('page'),'2');
});

 test('search links open the correct module directly and encode the authorized id',async()=>{
 const {searchResultHref}=await import('../src/reader/search.ts');
 assert.equal(searchResultHref('qa','q & 1','/help-centre?article=old'),'/help-centre/qa?question=q%20%26%201#qa-q%20%26%201');
 assert.equal(searchResultHref('qa','q & 1','/help-centre?article=old','en'),'/help-centre/qa?question=q%20%26%201&lang=en#qa-q%20%26%201');
 assert.equal(searchResultHref('article','one','/help-centre?article=old'),'/help-centre/articles/one');
 assert.equal(searchResultHref('ops','one','/help-centre?article=old','en'),'/help-centre/articles/one');
 assert.equal(searchResultHref('reference','r & 1','/help-centre?article=old','en'),'/help-centre/reference?article=r%20%26%201&lang=en');
 });
