import type {FeatureFlags} from '../features/model';
import {pageNavigation} from '../reader/page-navigation';
import {parseReaderBody,type Publication} from '../reader/body';
import {PageBody} from './gitbook/Reading/PageBody';
import {PageAside} from './gitbook/Reading/PageAside';
import {TableOfContents} from './gitbook/TableOfContents/TableOfContents';
import {selectTreePage,type NavigationNode} from '../reader/tree';
import type {ReactNode} from 'react';
import {ArticleReferenceProvider} from './gitbook/Media/ArticleReferenceContext';

/** Pages and publication are one server-authorized snapshot. */
export function ReaderNavigation({section,pages,requested,failed=false,actions,articleActions,article=null,features,locale='zh-CN',referenceAliases}:{
 section?:'ops';features?:FeatureFlags;pages:NavigationNode[];requested?:string|string[];failed?:boolean;actions?:ReactNode;articleActions?:ReactNode;article?:Publication|null;locale?:'zh-CN'|'en';referenceAliases?:Record<string,string>;
}) {
 const selected=failed?null:selectTreePage(pages,requested);
 const publication=selected&&article?.id===selected.id&&!failed?article:null;
 const navigation=publication?pageNavigation(pages,publication.id):null;
 const document=publication?parseReaderBody(publication.body):null;
 const unavailable=!failed&&requested!==undefined&&!publication;
 const visiblePages=(()=>{const result:import('../reader/navigation').NavigationPage[]=[];const visit=(nodes:NavigationNode[])=>{for(const node of nodes){if(node.type==='group')visit(node.descendants);else result.push(node);}};visit(pages);return result;})();
 const accountActions=<>
   {actions&&<div className="reader-actions">{actions}</div>}
 </>;
 return <div className="reader-layout">
   <TableOfContents section={section} pages={failed?[]:pages} currentPagePath={selected?.href??''} failed={failed} locale={publication?.locale??locale}/>
   {publication&&document&&navigation?<div className="reader-content has-outline">
     <PageAside key={`${publication.id}:${publication.revision}`} sections={document.sections} article={publication} articleActions={articleActions} features={features}/>
     <ArticleReferenceProvider pages={visiblePages} aliases={referenceAliases} locale={publication.locale}><PageBody section={section} article={publication} document={document} navigation={navigation}>{accountActions}</PageBody></ArticleReferenceProvider>
   </div>:<main id="main-content" className="reader-main">
     <p className="reader-eyebrow">{locale==='en'?'Team knowledge':'员工资料库'}</p>
     <h1>{locale==='en'?(failed?'The article directory is unavailable':unavailable?'This article is unavailable':'Welcome to the Help Centre'):failed?'目录暂时无法加载':unavailable?'文章暂不可用':'欢迎使用资料库'}</h1>
     <p className="reader-description">{locale==='en'?(failed?'We couldn’t load the article directory. Please try again.':unavailable?'You can choose another published article from the directory.':pages.length?'Choose an article from the directory.':'Published articles you can read will appear here.'):failed?'暂时无法取得资料目录，请重新加载。若持续失败，请联系管理员。'
       :unavailable?'该文章目前无法阅读。你可以从目录选择其他已发布资料。'
       :pages.length?'从文章目录选择你需要的资料。':'有你可以阅读的文章发布后，会显示在这里。'}</p>
     {failed&&<a className="secondary-link" href={locale==='en'?'/help-centre/library?lang=en':'/help-centre'}>{locale==='en'?'Try again':'重新加载'}</a>}
     {accountActions}
   </main>}
 </div>;
}
