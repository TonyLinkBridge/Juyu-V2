import {FilePdf,TextT} from '@phosphor-icons/react/dist/ssr';
import {MarkdownCopyButton} from 'fumadocs-ui/layouts/docs/page';
import {buttonVariants} from 'fumadocs-ui/components/ui/button';
import type {FeatureFlags} from '../../features/model';
import type {FavoriteState} from '../../favorites/model';
import type {Publication} from '../../reader/body';
import {fumadocsMarkdownPath,fumadocsPdfPath} from '../../fumadocs/publication';
import {FavoriteButton} from '../favorites/FavoriteButton';
// Reviewed JUYU adapters: Fumadocs provides neither persisted version-bound
// feedback nor text-size, page-width and font preferences as package APIs.
import {PageFeedbackForm} from '../reader-support/PageFeedbackForm';
import {ReaderAppearance} from '../reader-support/ReaderAppearance';

type SharedProps={article:Publication;features:FeatureFlags;viewerId?:string;favorite?:FavoriteState};

export function FumadocsPublicationActions({article,features,viewerId,favorite}:SharedProps){
 const english=article.locale==='en';
 const markdownUrl=fumadocsMarkdownPath(article.id,article.revision);
 const actionClass=buttonVariants({variant:'secondary',size:'sm',className:'gap-2 [&_svg]:size-3.5 [&_svg]:text-fd-muted-foreground'});
 return <section className="not-prose" data-fumadocs-publication-actions="" aria-label={english?'Article actions':'文章操作'}>
  <div className="mb-4 flex flex-row flex-wrap items-center gap-2 border-b pb-6" data-fumadocs-page-actions="">
   {features.favorites&&viewerId&&<FavoriteButton viewerId={viewerId} documentId={article.id} revision={article.revision} initial={favorite} locale={article.locale} buttonClassName={actionClass} recoveryButtonClassName={actionClass}/>}
   <MarkdownCopyButton markdownUrl={markdownUrl}/>
   <a className={actionClass} href={markdownUrl} target="_blank" rel="noopener noreferrer"><TextT aria-hidden="true"/>{english?'View Markdown':'查看 Markdown'}</a>
   {features.pdfExport&&<a className={actionClass} href={fumadocsPdfPath(article)}><FilePdf aria-hidden="true"/>{english?'Read / export PDF':'PDF 阅读／导出'}</a>}
  </div>
  <ReaderAppearance locale={article.locale}/>
 </section>;
}

export function FumadocsPublicationFeedback({article,features}:Pick<SharedProps,'article'|'features'>){
 if(!features.feedback)return null;
 return <div className="fumadocs-publication-feedback not-prose"><PageFeedbackForm
  key={`${article.id}:${article.revision}:${article.feedback?.memberId??'current'}`}
  documentId={article.id}
  revision={article.revision}
  initial={article.feedback?.value}
  publicationNumber={article.publicationNumber}
  locale={article.locale}
 /></div>;
}
