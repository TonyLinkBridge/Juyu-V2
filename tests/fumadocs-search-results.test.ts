import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {fumadocsSearchResults} from '../src/fumadocs/search.ts';

test('Fumadocs popup returns one summarized row per authorized publication',()=>{
 const results=fumadocsSearchResults({status:'ready',query:'信用额度',total:1,page:1,pages:1,results:[{
  id:'qa-1',title:'什么是信用额度？',href:'/help-centre/qa?question=qa-1',breadcrumbs:['账户'],
  kind:'qa',revision:3,tags:['信用额度'],snippet:'信用额度会根据账户情况进行审核。',
 }]});
 assert.equal(results.length,1);
 assert.deepEqual(results[0],{
  id:'qa-1',type:'page',url:'/help-centre/qa?question=qa-1',content:'什么是信用额度？',
  breadcrumbs:['Q&A 问答','账户'],title:'什么是信用额度？',snippet:'信用额度会根据账户情况进行审核。',
  kind:'qa',revision:3,total:1,
 });
});

test('Fumadocs popup keeps official list primitives and exposes errors and full results',async()=>{
 const source=await readFile('src/components/fumadocs/FumadocsScopedSearchDialog.tsx','utf8');
 assert.match(source,/SearchDialogListItem/);
 assert.match(source,/query\.error/);
 assert.match(source,/重新尝试|Try again/);
 assert.match(source,/查看全部结果|View all results/);
 assert.match(source,/searchHref/);
 assert.match(source,/NoStoreSearchCache/);
 assert.match(source,/query\.isLoading/);
 assert.match(source,/正在搜索|Searching/);
});
