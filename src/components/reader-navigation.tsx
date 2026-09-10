import type {FeatureFlags} from '../features/model';
import {pageNavigation} from '../reader/page-navigation';
import {parseReaderBody,type Publication} from '../reader/body';
import {PageBody} from './gitbook/Reading/PageBody';
import {PageAside} from './gitbook/Reading/PageAside';
import {TableOfContents} from './gitbook/TableOfContents/TableOfContents';
import {selectTreePage,type NavigationNode} from '../reader/tree';
import type {ReactNode} from 'react';

/** Pages and publication are one server-authorized snapshot. */
export function ReaderNavigation({pages,requested,failed=false,actions,articleActions,initialAdmin=false,article=null,features}:{
 features?:FeatureFlags;pages:NavigationNode[];requested?:string|string[];failed?:boolean;actions?:ReactNode;articleActions?:ReactNode;initialAdmin?:boolean;article?:Publication|null;
}) {
 const selected=failed?null:selectTreePage(pages,requested);
 const publication=selected&&article?.id===selected.id&&!failed?article:null;
 const navigation=publication?pageNavigation(pages,publication.id):null;
 const document=publication?parseReaderBody(publication.body):null;
 const unavailable=!failed&&requested!==undefined&&!publication;
 const accountActions=<>
   {initialAdmin&&<p className="connection-notice">你已成为首次开通的管理员。请再安排另一位 Admin，才能进行内容二审。</p>}
   {actions&&<div className="reader-actions">{actions}</div>}
 </>;
 return <div className="reader-layout">
   <TableOfContents pages={failed?[]:pages} currentPagePath={selected?.href??''} failed={failed}/>
   {publication&&document&&navigation?<div className={document.sections.length?'reader-content has-outline':'reader-content'}>
     <PageAside key={`${publication.id}:${publication.revision}`} sections={document.sections}/>
     <PageBody features={features} article={publication} document={document} navigation={navigation} articleActions={articleActions}>{accountActions}</PageBody>
   </div>:<main id="main-content" className="reader-main">
     <p className="reader-eyebrow">员工资料库</p>
     <h1>{failed?'目录暂时无法加载':unavailable?'文章暂不可用':'欢迎使用资料库'}</h1>
     <p className="reader-description">{failed?'暂时无法取得资料目录，请重新加载。若持续失败，请联系管理员。'
       :unavailable?'该文章目前无法阅读。你可以从目录选择其他已发布资料。'
       :pages.length?'从文章目录选择你需要的资料。':'有你可以阅读的文章发布后，会显示在这里。'}</p>
     {failed&&<a className="secondary-link" href="/help-centre">重新加载</a>}
     {accountActions}
   </main>}
 </div>;
}
