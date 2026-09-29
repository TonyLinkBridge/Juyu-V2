import assert from 'node:assert/strict';
import {test} from 'node:test';
import {isValidElement} from 'react';
import {encodeEditorBody} from '../src/editor/document.ts';
import {canonicalFumadocsPublicationPath,formalFumadocsPublicationPath,fumadocsMarkdownPath,fumadocsPdfPath,fumadocsPublication,fumadocsPublicationLanguages,fumadocsPublicationTree} from '../src/fumadocs/publication.ts';
import {fumadocsSearchResults} from '../src/fumadocs/search.ts';
import {fumadocsIconComponents} from '../src/fumadocs/icons.ts';
import {withoutEmptyPublishedParagraphs} from '../src/fumadocs/paragraphs.ts';

const body=encodeEditorBody([
 {id:'intro',type:'heading',props:{textAlignment:'left',textColor:'default',backgroundColor:'default',level:1},content:[{type:'text',text:'真实文章标题',styles:{}}],children:[]},
 {id:'details',type:'paragraph',props:{textAlignment:'left',textColor:'default',backgroundColor:'default'},content:[{type:'text',text:'正式发布的正文',styles:{}}],children:[
  {id:'nested',type:'heading',props:{textAlignment:'left',textColor:'default',backgroundColor:'default',level:2},content:[{type:'text',text:'嵌套标题',styles:{}}],children:[]},
 ]},
]);

test('published BlockNote body becomes the Fumadocs document and table of contents',()=>{
 const result=fumadocsPublication({body});
 assert.equal(result.blocks[0].id,'intro');
 assert.deepEqual(result.toc,[
  {title:'真实文章标题',url:'#intro',depth:2},
  {title:'嵌套标题',url:'#nested',depth:3},
 ]);
});

test('draft and formal readers drop empty paragraphs without dropping nested content',()=>{
 const blocks=[
  {id:'empty-top',type:'paragraph' as const,props:{textAlignment:'left' as const,textColor:'default' as const,backgroundColor:'default' as const},content:[],children:[]},
  {id:'parent',type:'paragraph' as const,props:{textAlignment:'left' as const,textColor:'default' as const,backgroundColor:'default' as const},content:[{type:'text' as const,text:'保留正文',styles:{}}],children:[
   {id:'empty-nested',type:'paragraph' as const,props:{textAlignment:'left' as const,textColor:'default' as const,backgroundColor:'default' as const},content:[{type:'text' as const,text:'   ',styles:{}}],children:[]},
   {id:'nested',type:'paragraph' as const,props:{textAlignment:'left' as const,textColor:'default' as const,backgroundColor:'default' as const},content:[{type:'text' as const,text:'保留子段落',styles:{}}],children:[]},
  ]},
 ];
 const result=withoutEmptyPublishedParagraphs(blocks);
 assert.deepEqual(result.map(block=>block.id),['parent']);
 assert.deepEqual(result[0]?.children.map(block=>block.id),['nested']);
 assert.equal(blocks[1]?.children.length,2);
});

test('legacy text is rejected instead of being silently simplified',()=>{
 assert.throws(()=>fumadocsPublication({body:'普通旧正文'}),/BLOCKNOTE_BODY_REQUIRED/);
});

test('top-level categories use official Fumadocs separators while nested categories remain folders',()=>{
 const tree=fumadocsPublicationTree([
  {type:'group',id:'account',title:'账户管理',iconKey:'shield',descendants:[
   {type:'document',id:'article 1',title:'修改邮箱',description:'更新登录邮箱',iconKey:'file',href:'/help-centre?article=article%201'},
   {type:'group',id:'security',title:'账户安全',indexDocumentId:'article 2',descendants:[
    {type:'document',id:'article 2',title:'修改密码',href:'/help-centre?article=article%202'},
   ]},
  ]},
 ],'zh-CN');
 assert.equal(tree.type,'root');
 assert.equal(typeof tree.$id,'string');
 assert.ok(tree.$id && tree.$id.length>0);
 assert.equal(tree.name,'资料目录');
 const root=tree.children[0];
 assert.equal(root?.type,'folder');
 if(root?.type!=='folder')throw new Error('missing root folder');
 assert.equal(typeof root.$id,'string');
 assert.ok(root.$id && root.$id.length>0);
 const section=root.children[0];
 assert.equal(section?.type,'separator');
 if(section?.type!=='separator')throw new Error('missing category separator');
 assert.equal(section.name,'账户管理');
 assert.ok(isValidElement(section.icon));
 assert.equal(section.icon.type,fumadocsIconComponents.shield);
 const page=root.children[1];
 assert.equal(page?.type,'page');
 if(page?.type!=='page')throw new Error('missing article page');
 assert.equal(page.description,'更新登录邮箱');
 assert.ok(isValidElement(page.icon));
 assert.equal(page.icon.type,fumadocsIconComponents.file);
 assert.equal(page.url,'/design-preview/fumadocs-reader/article%201');
 const nested=root.children[2];
 assert.equal(nested?.type,'folder');
 if(nested?.type!=='folder')throw new Error('missing nested category folder');
 assert.equal(nested.name,'账户安全');
 assert.equal(nested.index?.type,'page');
 assert.equal(nested.index?.url,'/design-preview/fumadocs-reader/article%202');
 assert.equal(nested.children.length,0);
 assert.equal(canonicalFumadocsPublicationPath('article 1'),'/design-preview/fumadocs-reader/article%201');
});

test('Fumadocs tree identity is stable for the same directory and changes with its scope or contents',()=>{
 const articleNodes:Parameters<typeof fumadocsPublicationTree>[0]=[
  {type:'document',id:'article-1',title:'修改邮箱',href:'/help-centre?article=article-1'},
 ];
 const same=fumadocsPublicationTree(articleNodes,'zh-CN','formal','article');
 const repeated=fumadocsPublicationTree(articleNodes,'zh-CN','formal','article');
 const ops=fumadocsPublicationTree(articleNodes,'zh-CN','formal','ops');
 const changed=fumadocsPublicationTree([
  ...articleNodes,
  {type:'document',id:'article-2',title:'修改密码',href:'/help-centre?article=article-2'},
 ],'zh-CN','formal','article');
 assert.equal(same.$id,repeated.$id);
 assert.notEqual(same.$id,ops.$id);
 assert.notEqual(same.$id,changed.$id);
});

test('formal reader paths stay under Help Centre and the entire authorized tree uses them',()=>{
 assert.equal(formalFumadocsPublicationPath('article 1'),'/help-centre/articles/article%201');
 assert.equal(formalFumadocsPublicationPath('ops 1','ops'),'/help-centre/ops/ops%201');
 const tree=fumadocsPublicationTree([{type:'document',id:'article 1',slug:'修改邮箱',title:'修改邮箱',href:'/help-centre/articles/%E4%BF%AE%E6%94%B9%E9%82%AE%E7%AE%B1'}],'zh-CN','formal');
 assert.equal(tree.children[0]?.type,'folder');
 if(tree.children[0]?.type!=='folder')throw new Error('missing root folder');
 assert.deepEqual(tree.children[0].children,[{type:'page',$id:'article 1',name:'修改邮箱',url:'/help-centre/articles/%E4%BF%AE%E6%94%B9%E9%82%AE%E7%AE%B1'}]);
 assert.deepEqual(fumadocsPublicationLanguages({id:'zh',slug:'中文标题',locale:'zh-CN',sourceId:'zh',sourceSlug:'中文标题',englishId:'en',englishSlug:'english-title'},'formal'),{
  'zh-CN':'/help-centre/articles/%E4%B8%AD%E6%96%87%E6%A0%87%E9%A2%98',
  en:'/help-centre/articles/english-title',
 });
 const opsTree=fumadocsPublicationTree([{type:'document',id:'ops 1',slug:'升级处理',title:'升级处理',href:'/help-centre/articles/%E5%8D%87%E7%BA%A7%E5%A4%84%E7%90%86'}],'zh-CN','formal','ops');
 assert.equal(opsTree.children[0]?.type,'folder');
 if(opsTree.children[0]?.type!=='folder')throw new Error('missing OPS root folder');
 assert.deepEqual(opsTree.children[0].children,[{type:'page',$id:'ops 1',name:'升级处理',url:'/help-centre/ops/%E5%8D%87%E7%BA%A7%E5%A4%84%E7%90%86'}]);
 assert.deepEqual(fumadocsPublicationLanguages({id:'ops-zh',slug:'处理升级',locale:'zh-CN',sourceId:'ops-zh',sourceSlug:'处理升级',englishId:'ops-en',englishSlug:'ops-upgrade'},'formal','ops'),{
  'zh-CN':'/help-centre/ops/%E5%A4%84%E7%90%86%E5%8D%87%E7%BA%A7',
  en:'/help-centre/ops/ops-upgrade',
 });
});

test('reader actions keep protected article URLs scoped to the current revision',()=>{
 assert.equal(fumadocsMarkdownPath('article 1',7),'/api/articles/article%201/markdown?revision=7');
 assert.equal(fumadocsPdfPath({id:'article 1',revision:7,locale:'en'}),'/help-centre/pdf?article=article%201&revision=7&lang=en');
});

test('language switch exposes only published counterparts and never a coming soon option',()=>{
 assert.deepEqual(fumadocsPublicationLanguages({id:'zh-only',locale:'zh-CN',sourceId:'zh-only',englishId:null}),{'zh-CN':'/design-preview/fumadocs-reader/zh-only'});
 assert.deepEqual(fumadocsPublicationLanguages({id:'zh',locale:'zh-CN',sourceId:'zh',englishId:'en'}),{
  'zh-CN':'/design-preview/fumadocs-reader/zh',
  en:'/design-preview/fumadocs-reader/en',
 });
 assert.deepEqual(fumadocsPublicationLanguages({id:'en',locale:'en',sourceId:'zh',englishId:'en'}),{
  'zh-CN':'/design-preview/fumadocs-reader/zh',
  en:'/design-preview/fumadocs-reader/en',
 });
});

test('Fumadocs search keeps authorized module destinations and uses separate formal paths for articles and OPS',()=>{
 const results=fumadocsSearchResults({status:'ready',query:'信用',total:4,page:1,pages:1,results:[
  {id:'article one',title:'信用额度',href:'/help-centre/articles/credit-limit',breadcrumbs:['账户'],snippet:'查看信用额度',kind:'article'},
  {id:'ops one',title:'信用额度升级',href:'/help-centre/ops/credit-limit-upgrade',breadcrumbs:['运营'],snippet:'升级信用额度',kind:'ops'},
  {id:'qa-one',title:'信用额度问答',href:'/help-centre/qa?question=qa-one',breadcrumbs:['Q&A'],kind:'qa'},
  {id:'reference-one',title:'信用额度速查',href:'/help-centre/reference?article=reference-one',breadcrumbs:['Reference'],kind:'reference'},
 ]});
 assert.deepEqual(results.map(item=>[item.id,item.type,item.url]),[
  ['article one','page','/help-centre/articles/credit-limit'],
  ['ops one','page','/help-centre/ops/credit-limit-upgrade'],
  ['qa-one','page','/help-centre/qa?question=qa-one'],
  ['reference-one','page','/help-centre/reference?article=reference-one'],
 ]);
});
