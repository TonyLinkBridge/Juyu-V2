// Adapted from GitBook PageAside: one responsive outline and article action rail.
import type {ReactNode} from 'react';
import {FilePdf} from '@phosphor-icons/react/dist/ssr';
import type {FeatureFlags} from '../../../features/model';
import type {DocumentSection,Publication} from '../../../reader/body';
import {ScrollSectionsList} from './ScrollSectionsList';
import {PageFeedbackForm} from './PageFeedbackForm';
export function PageAside({sections,article,articleActions,features}:{sections:DocumentSection[];article:Publication;articleActions?:ReactNode;features?:FeatureFlags}) {
 return <aside className="gitbook-page-aside group/aside" aria-label="文章目录与操作">
   {sections.length>0&&<details open className="outline-disclosure"><summary>本页内容</summary>
     <nav aria-label="本页目录" data-gb-page-outline className="overflow-y-auto"><ScrollSectionsList sections={sections}/></nav>
   </details>}
   {(articleActions||features?.pdfExport!==false)&&<div className="article-side-actions" aria-label="文章操作">
    {articleActions}
    {features?.pdfExport!==false&&<a className="reader-pdf-link" href={`/help-centre/pdf?article=${encodeURIComponent(article.id)}&revision=${article.revision}`}><FilePdf size={20} aria-hidden="true"/> PDF 阅读／导出</a>}
   </div>}
   {features?.feedback!==false&&<PageFeedbackForm key={`${article.id}:${article.revision}:${article.feedback?.memberId??'current'}`} documentId={article.id} revision={article.revision} initial={article.feedback?.value}/>}
 </aside>;
}
