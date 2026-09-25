import assert from 'node:assert/strict';
import test from 'node:test';
import {fumadocsSearchOptions,parseFumadocsSearchRequest} from '../src/fumadocs/search-options.ts';

test('Fumadocs search exposes all five JUYU content scopes with localized labels',()=>{
 const zh=fumadocsSearchOptions('zh-CN');
 assert.equal(zh.api,'/api/fumadocs-search');
 assert.equal(zh.defaultTag,'all');
 assert.deepEqual(zh.tags?.map(tag=>[tag.value,tag.name]),[
  ['all','全部资料'],['article','知识文章'],['ops','OPS Internal'],['reference','Reference 速查'],['qa','Q&A 问答'],
 ]);
 const en=fumadocsSearchOptions('en');
 assert.deepEqual(en.tags?.map(tag=>tag.name),['All content','Articles','OPS Internal','Reference','Q&A']);
});

test('Fumadocs search request accepts one official tag and rejects forged filters',()=>{
 assert.deepEqual(parseFumadocsSearchRequest(new URL('https://local/api/fumadocs-search?query=credit&locale=en&tag=qa')), {
  query:'credit',locale:'en',scope:'qa',status:'ready',
 });
 assert.deepEqual(parseFumadocsSearchRequest(new URL('https://local/api/fumadocs-search?query=%E4%BF%A1%E7%94%A8%E9%A2%9D%E5%BA%A6&tag=all')), {
  query:'信用额度',locale:'zh-CN',scope:'all',status:'ready',
 });
 for(const query of [
  '?query=x&tag=admin','?query=x&tag=qa&tag=article','?query=x&scope=qa','?query=x&locale=fr',
 ])assert.throws(()=>parseFumadocsSearchRequest(new URL(`https://local/api/fumadocs-search${query}`)),/INVALID_INPUT/);
});
