import {FieldValues} from '../../fields/FieldValues';
import {MediaBlocks} from '../Media/MediaBlocks';
import {PageCover} from './PageCover';
import type {PageNavigation} from '../../../reader/page-navigation';
import {PageHeader} from './PageHeader';
import {PageFooterNavigation} from './PageFooterNavigation';
import {ScrollToTopButton} from './ScrollToTopButton';
// Adapted from GitBook PageBody/PageBody.tsx (GPL-3.0).
// Retain main/header/content/empty-body structure; vendor-only actions omitted.
import type {ReactNode} from 'react';
import type {Publication,ReaderDocument} from '../../../reader/body';
import {DocumentView} from './DocumentView';
export function PageBody({section,article,document,navigation,children}:{section?:'ops';article:Publication;document:ReaderDocument;navigation:PageNavigation;children?:ReactNode}) {
 return <main id="main-content" className="reader-main gitbook-page-body relative min-w-0 flex-1 flex flex-col">
   <div className="min-w-0 grow">
     <PageCover cover={article.cover} locale={article.locale}/>
     <PageHeader section={section} article={article} navigation={navigation}/>
     <FieldValues fields={article.customFields}/>
     {(document.editorBlocks?.length??document.blocks.length)?<DocumentView document={document} documentId={article.id} revision={article.revision} locale={article.locale}/>:<p className="reader-description">{article.locale==='en'?'This article has no body yet.':'这篇文章暂时没有正文。'}</p>}
     {!document.editorBlocks&&<MediaBlocks blocks={article.blocks} documentId={article.id} revision={article.revision}/>}
   </div>
   <PageFooterNavigation previous={navigation.previous} next={navigation.next} locale={article.locale}/>
   <div className="reader-top-action"><ScrollToTopButton className="reader-back-to-top">{article.locale==='en'?'Back to top':'回到顶部'} <span aria-hidden="true">↑</span></ScrollToTopButton></div>
   {children}
 </main>;
}
