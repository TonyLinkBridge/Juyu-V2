import assert from 'node:assert/strict';import {test} from 'node:test';import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {loadSearchViews} from './helpers/search-view.ts';import type {TitleSearch} from '../src/reader/search.ts';
test('unified results expose only server-provided escaped snippets and document metadata',async()=>{
 const {SearchResults}=await loadSearchViews();
 const search:TitleSearch={status:'ready',query:'转出',total:1,page:1,pages:1,results:[{id:'one',title:'费用说明',href:'/help-centre?article=one',breadcrumbs:['业务'],snippet:'转出需要核对 <script>示例</script>',kind:'reference',revision:3,tags:['转出费用标签']}]};
 const html=renderToStaticMarkup(createElement(SearchResults,{search,retryHref:'/help-centre?q=转出'}));
 assert.ok(html.includes('search-result-snippet'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('Reference'));assert.ok(html.includes('费用标签'));assert.ok(html.includes('正式版本'));assert.ok(html.includes('href="/help-centre?article=one"'));assert.ok(html.includes('标题、标签和正文'));
 for(const failed of [true]){const hidden=renderToStaticMarkup(createElement(SearchResults,{search,failed,retryHref:'/help-centre?q=转出'}));assert.ok(!hidden.includes('费用说明'));assert.ok(!hidden.includes('核对'));assert.ok(!hidden.includes('找到 1'));assert.ok(hidden.includes('搜索暂时无法加载'));}
});

test('mixed search counts results and gives Q&A an answer identity and canonical link',async()=>{
 const {SearchResults}=await loadSearchViews();
 const search:TitleSearch={status:'ready',query:'账户',total:24,page:1,pages:2,results:[{id:'qa',title:'账户问题',href:'/help-centre/qa?question=qa',breadcrumbs:[],kind:'qa'},{id:'doc',title:'账户指南',href:'/help-centre?article=doc',breadcrumbs:['账户管理'],kind:'article'}]};
 const html=renderToStaticMarkup(createElement(SearchResults,{search,retryHref:'/help-centre?q=账户'}));
 assert.ok(html.includes('24 项结果'));assert.ok(!html.includes('篇文章'));assert.ok(html.includes('Q&amp;A 问答'));assert.ok(html.includes('查看答案：账户问题'));assert.ok(html.includes('href="/help-centre/qa?question=qa"'));assert.ok(html.includes('知识文章'));
 const empty=renderToStaticMarkup(createElement(SearchResults,{search:{...search,total:0,results:[]},retryHref:'/help-centre?q=账户'}));assert.ok(empty.includes('没有找到相关结果'));assert.ok(!empty.includes('相关文章'));
});
