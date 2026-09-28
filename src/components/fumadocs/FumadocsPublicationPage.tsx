import {DocsBody,DocsDescription,DocsPage,DocsTitle,PageLastUpdate} from 'fumadocs-ui/layouts/docs/page';
import type {FeatureFlags} from '../../features/model';
import type {FavoriteState} from '../../favorites/model';
import type {NavigationPage} from '../../reader/navigation';
import type {Publication} from '../../reader/body';
import type {ContentKind} from '../../domain/model';
import {fumadocsPublication} from '../../fumadocs/publication';
import {ArticleAnalytics} from '../analytics/ArticleAnalytics';
import {RecentRecorder} from '../recent/RecentRecorder';
import {FumadocsBlockNoteReader} from './FumadocsBlockNoteReader';
import {fumadocsBlockNoteTocSlots} from './FumadocsBlockNoteTocBridge';
import {FumadocsPublicationActions,FumadocsPublicationFeedback} from './FumadocsPublicationActions';

interface Props {
 article:Publication;
 features:FeatureFlags;
 viewerId?:string;
 favorite?:FavoriteState;
 formal?:boolean;
 recentKind?:ContentKind;
 referencePages?:NavigationPage[];
 referenceAliases?:Record<string,string>;
}

/** Shared formal reader surface. Knowledge, OPS and Q&A render through this exact component. */
export function FumadocsPublicationPage({article,features,viewerId,favorite,formal=true,recentKind='article',referencePages=[],referenceAliases}:Props){
 const locale=article.locale==='en'?'en':'zh-CN';
 const document=fumadocsPublication(article);
 return <DocsPage
  data-fumadocs-publication=""
  toc={document.toc}
  slots={{toc:fumadocsBlockNoteTocSlots}}
  breadcrumb={{enabled:false}}
 >
  <DocsTitle>{article.title}</DocsTitle>
  {article.description&&<DocsDescription className="mb-2">{article.description}</DocsDescription>}
  <FumadocsPublicationActions article={article} features={features} viewerId={viewerId} favorite={favorite}/>
  {formal&&features.recent&&<RecentRecorder documentId={article.id} revision={article.revision} kind={recentKind}/>}
  {formal&&features.analytics&&<ArticleAnalytics documentId={article.id} revision={article.revision}/>}
  <DocsBody><FumadocsBlockNoteReader blocks={document.blocks} published locale={locale} documentId={article.id} revision={article.revision} referencePages={referencePages} referenceAliases={referenceAliases}/></DocsBody>
  <FumadocsPublicationFeedback article={article} features={features}/>
  {article.publishedAt&&<PageLastUpdate data-fumadocs-last-update="" date={new Date(article.publishedAt)}/>}
 </DocsPage>;
}
