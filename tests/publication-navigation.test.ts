import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement,type ComponentType} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadComponent} from './helpers/render-component.ts';

test('formal article uses the menu from its authorized read without a second directory request',async()=>{
 let secondRead=0;
 const article={id:'shop',slug:'签约店铺（个人-企业）',title:'店铺',locale:'zh-CN',body:'fixture'};
 const {FumadocsAuthorizedPublication}=loadComponent('src/components/fumadocs/FumadocsAuthorizedPublication.tsx',{
  '../../fumadocs/publication':{formalFumadocsPublicationPath:(slug:string)=>'/help-centre/articles/'+encodeURIComponent(slug),fumadocsPublicationTree:()=>({name:'资料',children:[]}),fumadocsPublicationLanguages:()=>({})},
  '../../fumadocs/tabs':{fumadocsContentTabs:(_menu:unknown,_locale:unknown,_path:unknown,knowledgeEntry:string)=>[{url:knowledgeEntry}]},
  './FumadocsDocsLayout':{FumadocsDocsLayout:'layout'},
  './FumadocsPublicationI18n':{FumadocsPublicationI18n:'i18n'},
  './FumadocsAccountFooter':{FumadocsAccountFooter:'footer'},
  './FumadocsSearchProvider':{FumadocsSearchProvider:'search'},
  './FumadocsPublicationPage':{FumadocsPublicationPage:'article'},
  '../../server/authorization/application':{applicationAuthorization:async()=>({reader:async()=>({article,pages:[],features:{search:true},chrome:{items:[],features:{search:true},knowledgeEntry:'/help-centre/articles/普通会员'}})})},
  '../../server/reader-presentation':{readReaderPresentation:async()=>{secondRead++;throw Error('Duplicate directory read');}},
 });
 const tree=await (FumadocsAuthorizedPublication as (props:unknown)=>Promise<unknown>)({articleId:encodeURIComponent(article.slug),mode:'formal',routeSection:'article'});
 assert.equal(secondRead,0);
 assert.match(JSON.stringify(tree),/普通会员/);
});

test('Fumadocs link adapter retains the exact original URL and forwards standard navigation props',()=>{
 let received:Record<string,unknown>|undefined;
 const {FumadocsNavigationLink}=loadComponent('src/components/fumadocs/FumadocsNavigationLink.tsx',{
  '../shell/NavigationLink':{NavigationLink:(props:Record<string,unknown>)=>{received=props;return createElement('a',{href:props.href as string},props.children as string);}},
 });
 const href='/help-centre/articles/'+encodeURIComponent('签约店铺（个人-企业）');
 renderToStaticMarkup(createElement(FumadocsNavigationLink as ComponentType<Record<string,unknown>>,{href,prefetch:false,target:'_blank'},'店铺'));
 assert.equal(received?.href,href);
 assert.equal(received?.prefetch,false);
 assert.equal(received?.target,'_blank');
 assert.notEqual(received?.prefetchOnIntent,true);
});
