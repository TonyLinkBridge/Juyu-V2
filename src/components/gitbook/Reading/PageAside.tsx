// Adapted from GitBook PageAside: one responsive outline and article action rail.
import type {ReactNode} from 'react';
import {FilePdf} from '@phosphor-icons/react/dist/ssr';
import type {FeatureFlags} from '../../../features/model';
import type {DocumentSection,Publication} from '../../../reader/body';
import {ScrollSectionsList} from './ScrollSectionsList';
import {PageFeedbackForm} from './PageFeedbackForm';
import {ArticleMarkdownActions} from './ArticleMarkdownActions';
import {ReaderAppearance} from './ReaderAppearance';
export function PageAside({sections,article,articleActions,features}:{sections:DocumentSection[];article:Publication;articleActions?:ReactNode;features?:FeatureFlags}) {
 const english=article.locale==='en';
 return <aside className="gitbook-page-aside group/aside" aria-label={english?'On this page and article actions':'文章目录与操作'}>
   {sections.length>0&&<details open className="outline-disclosure"><summary>{english?'On this page':'本页内容'}</summary>
     <nav aria-label={english?'On this page':'本页目录'} data-gb-page-outline className="overflow-y-auto"><ScrollSectionsList sections={sections}/></nav>
   </details>}
   <ReaderAppearance locale={article.locale}/>
   <div className="article-side-actions" aria-label={english?'Article actions':'文章操作'}>
    {articleActions}
    {features?.pdfExport!==false&&<a className="reader-pdf-link" href={`/help-centre/pdf?article=${encodeURIComponent(article.id)}&revision=${article.revision}${english?'&lang=en':''}`}><FilePdf size={20} aria-hidden="true"/> {english?'Read / export PDF':'PDF 阅读／导出'}</a>}
    <ArticleMarkdownActions article={article}/>
   </div>
   {features?.feedback!==false&&<PageFeedbackForm key={`${article.id}:${article.revision}:${article.feedback?.memberId??'current'}`} documentId={article.id} revision={article.revision} initial={article.feedback?.value} publicationNumber={article.publicationNumber} locale={article.locale}/>}
 </aside>;
}
