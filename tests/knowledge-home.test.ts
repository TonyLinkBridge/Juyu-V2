import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement,type ComponentType} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadComponent} from './helpers/render-component.ts';
const {KnowledgeHome}=loadComponent('src/components/home/KnowledgeHome.tsx',{'@phosphor-icons/react/dist/ssr':new Proxy({},{get:()=>()=>null}),'./KnowledgeHomeHero':{KnowledgeHomeHero:()=>createElement('header',null,'Search')}});
const pages=[{type:'group',id:'00000000-0000-4000-8000-000000000001',title:'会员',descendants:[{type:'document',id:'one',title:'普通会员',href:'/help-centre/articles/普通会员'}]}];
function render(showRecent=true){return renderToStaticMarkup(createElement(KnowledgeHome as ComponentType<Record<string,unknown>>,{pages,menu:[],latest:[{id:'one',title:'普通会员',updated:'2026-10-15T00:00:00Z'}],recent:[],showRecent}));}
test('homepage shows backend categories before recent activity without a self-return link',()=>{
 const html=render();assert.match(html,/directory-category-card/);assert.match(html,/href="\/help-centre\/categories\/00000000-0000-4000-8000-000000000001"/);assert.ok(html.indexOf('directory-category-card')<html.indexOf('最近修订'));assert.match(html,/最近浏览/);assert.doesNotMatch(html,/home-featured|返回知识库首页/);
});
test('homepage respects the recent-history feature flag',()=>{const html=render(false);assert.match(html,/最近修订/);assert.doesNotMatch(html,/最近浏览/);});
