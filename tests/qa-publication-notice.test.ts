import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement,type ComponentType} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadComponent} from './helpers/render-component.ts';
import type {WorkspaceItem} from '../src/workspace/model.ts';
const {TaskCategories}=loadComponent('src/components/tasks/TaskCategories.tsx');
const task:WorkspaceItem={id:'test-only',kind:'qa',title:'测试问答',qaCategory:'Whois 隐私保护',status:'approved',sequence:6,revision:6,publishedRevision:null,updatedAt:'2026-11-16T02:00:00Z',author:'Test',editor:'Test',submitter:'Test',reviewer:'Test'};
const render=(patch:Partial<WorkspaceItem>={})=>renderToStaticMarkup(createElement(TaskCategories as ComponentType<{task:WorkspaceItem}>,{task:{...task,...patch}}));
test('approved and queued Q&A explain why an unpublished category is absent',()=>{
 for(const status of ['approved','queued'] as const){const html=render({status});assert.match(html,/分类暂不显示在员工页面/);assert.match(html,/Whois 隐私保护/);}
});
test('Q&A with an older publication explains that employees still see the formal categories',()=>{
 const html=render({publishedRevision:3});assert.match(html,/员工仍看到正式版内容和分类/);assert.doesNotMatch(html,/分类暂不显示在员工页面/);
});
test('published answers and other content types do not show an unpublished-Q&A warning',()=>{
 for(const status of ['draft','in_review','changes_requested','published'] as const)assert.doesNotMatch(render({status}),/分类暂不显示在员工页面|员工仍看到正式版内容和分类/);
 for(const kind of ['article','ops','reference'] as const)assert.doesNotMatch(render({kind}),/分类暂不显示在员工页面|员工仍看到正式版内容和分类/);
});
