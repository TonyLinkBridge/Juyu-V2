import {MarkdownCopyButton} from 'fumadocs-ui/layouts/docs/page';
import {buttonVariants} from 'fumadocs-ui/components/ui/button';
import type {FeatureFlags} from '../../features/model';
import type {FavoriteState} from '../../favorites/model';
import type {Publication} from '../../reader/body';
import {fumadocsMarkdownPath,fumadocsPdfPath} from '../../fumadocs/publication';
import {FavoriteButton} from '../favorites/FavoriteButton';
import {PageFeedbackForm} from '../reader-support/PageFeedbackForm';
import {FumadocsPublicationOpenMenu} from './FumadocsPublicationOpenMenu';

type SharedProps={article:Publication;features:FeatureFlags;viewerId?:string;favorite?:FavoriteState};

export function FumadocsPublicationActions({article,features,viewerId,favorite}:SharedProps){
 const english=article.locale==='en';
 const markdownUrl=fumadocsMarkdownPath(article.id,article.revision);
 const pdfUrl=features.pdfExport?fumadocsPdfPath(article):undefined;
 const actionClass=buttonVariants({variant:'secondary',size:'sm',className:'gap-2 [&_svg]:size-3.5 [&_svg]:text-fd-muted-foreground'});
 return <section className="not-prose" data-fumadocs-publication-actions="" aria-label={english?'Article actions':'文章操作'}>
  <div className="mb-4 flex flex-row flex-wrap items-center gap-2 border-b pb-6" data-fumadocs-page-actions="">
   {features.favorites&&viewerId&&<FavoriteButton viewerId={viewerId} documentId={article.id} revision={article.revision} initial={favorite} locale={article.locale} buttonClassName={actionClass} recoveryButtonClassName={actionClass}/>}
   <MarkdownCopyButton markdownUrl={markdownUrl}/>
   <FumadocsPublicationOpenMenu english={english} markdownUrl={markdownUrl} pdfUrl={pdfUrl}/>
  </div>
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
