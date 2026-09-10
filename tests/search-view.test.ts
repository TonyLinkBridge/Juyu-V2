import assert from 'node:assert/strict';import {test} from 'node:test';import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {loadSearchViews} from './helpers/search-view.ts';import type {TitleSearch} from '../src/reader/search.ts';
test('unified results expose only server-provided escaped snippets and document metadata',async()=>{
 const {SearchResults}=await loadSearchViews();
 const search:TitleSearch={status:'ready',query:'转出',total:1,page:1,pages:1,results:[{id:'one',title:'费用说明',href:'/help-centre?article=one',breadcrumbs:['业务'],snippet:'转出需要核对 <script>示例</script>',kind:'reference',revision:3,tags:['转出费用标签']}]};
 const html=renderToStaticMarkup(createElement(SearchResults,{search,retryHref:'/help-centre?q=转出'}));
 assert.ok(html.includes('search-result-snippet'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('Reference'));assert.ok(html.includes('费用标签'));assert.ok(html.includes('正式版本'));assert.ok(html.includes('href="/help-centre?article=one"'));assert.ok(html.includes('标题、标签和正文'));
 for(const failed of [true]){const hidden=renderToStaticMarkup(createElement(SearchResults,{search,failed,retryHref:'/help-centre?q=转出'}));assert.ok(!hidden.includes('费用说明'));assert.ok(!hidden.includes('核对'));assert.ok(!hidden.includes('找到 1'));assert.ok(hidden.includes('搜索暂时无法加载'));}
});
