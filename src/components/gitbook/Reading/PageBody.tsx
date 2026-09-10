import type {FeatureFlags} from '../../../features/model';
import {FieldValues} from '../../fields/FieldValues';
import {MediaBlocks} from '../Media/MediaBlocks';
import {PageFeedbackForm} from './PageFeedbackForm';
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
export function PageBody({article,document,navigation,children,articleActions,features}:{article:Publication;document:ReaderDocument;navigation:PageNavigation;children?:ReactNode;articleActions?:ReactNode;features?:FeatureFlags}) {
 return <main id="main-content" className="reader-main gitbook-page-body relative min-w-0 flex-1 flex flex-col">
   <div className="min-w-0 grow">
     <PageCover cover={article.cover}/>
     <PageHeader article={article} navigation={navigation}/>
     {features?.pdfExport!==false&&<a className="reader-pdf-link secondary-link" href={`/help-centre/pdf?article=${encodeURIComponent(article.id)}&revision=${article.revision}`}>PDF 阅读／导出</a>}
     {articleActions}
     <FieldValues fields={article.customFields}/>
     {(document.editorBlocks?.length??document.blocks.length)?<DocumentView document={document} documentId={article.id} revision={article.revision}/>:<p className="reader-description">这篇文章暂时没有正文。</p>}
     {!document.editorBlocks&&<MediaBlocks blocks={article.blocks} documentId={article.id} revision={article.revision}/>}
   </div>
   {features?.feedback!==false&&<PageFeedbackForm key={`${article.id}:${article.revision}`} documentId={article.id} revision={article.revision}/>}
   <PageFooterNavigation previous={navigation.previous} next={navigation.next}/>
   <div className="reader-top-action"><ScrollToTopButton className="reader-back-to-top">回到顶部 <span aria-hidden="true">↑</span></ScrollToTopButton></div>
   {children}
 </main>;
}
