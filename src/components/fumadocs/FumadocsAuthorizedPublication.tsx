import {DocsLayout} from 'fumadocs-ui/layouts/docs';
import {DocsBody,DocsDescription,DocsPage,DocsTitle} from 'fumadocs-ui/layouts/docs/page';
import {notFound,redirect} from 'next/navigation';
import {applicationAuthorization} from '../../server/authorization/application';
import {canonicalFumadocsPublicationPath,formalFumadocsPublicationPath,fumadocsPublication,fumadocsPublicationLanguages,fumadocsPublicationTree,type FumadocsReaderMode} from '../../fumadocs/publication';
import type {NavigationPage} from '../../reader/navigation';
import type {NavigationNode} from '../../reader/tree';
import type {MenuItem} from '../../navigation-settings/model';
import {FumadocsBlockNoteReader} from './FumadocsBlockNoteReader';
import {FumadocsPublicationI18n} from './FumadocsPublicationI18n';
import {FumadocsPublicationActions,FumadocsPublicationFeedback} from './FumadocsPublicationActions';
import {ArticleAnalytics} from '../analytics/ArticleAnalytics';
import {RecentRecorder} from '../recent/RecentRecorder';
import {fumadocsMenuLinks} from '../../fumadocs/layout';
import {FumadocsAccountFooter} from './FumadocsAccountFooter';
import {FumadocsSearchProvider} from './FumadocsSearchProvider';

const previewRoot='/design-preview/fumadocs-reader';

function referencePages(nodes:NavigationNode[],mode:FumadocsReaderMode):NavigationPage[]{
 const pages:NavigationPage[]=[],seen=new Set<string>();
 const visit=(items:NavigationNode[])=>{for(const item of items){
  if(item.type==='group')visit(item.descendants);
  else if(!seen.has(item.id)){
   seen.add(item.id);
   pages.push({...item,href:mode==='formal'?formalFumadocsPublicationPath(item.id):canonicalFumadocsPublicationPath(item.id)});
  }
 }};
 visit(nodes);
 return pages;
}

export async function FumadocsAuthorizedPublication({articleId,mode='preview'}:{articleId:string;mode?:FumadocsReaderMode}){
 if(!articleId.trim()||articleId.length>200)notFound();
 const formal=mode==='formal';
 let result:Awaited<ReturnType<Awaited<ReturnType<typeof applicationAuthorization>>['reader']>>;
 let menu:MenuItem[]=[];
 try{
  const authorization=await applicationAuthorization();
  if(!formal)await authorization.requireEditorAdmin();
  result=await authorization.reader(articleId);
  if(formal)try{menu=await authorization.readerMenu();}catch{}
 }catch{notFound();}
 if(result.destination)redirect(result.destination);
 if(!result.article)notFound();
 const article=result.article;
 const locale=article.locale==='en'?'en':'zh-CN';
 const document=fumadocsPublication(article);
 const tree=fumadocsPublicationTree(result.pages,locale,mode);
 const destinations=fumadocsPublicationLanguages(article,mode);
 const root=formal?'/help-centre':previewRoot;
 return <FumadocsSearchProvider locale={locale}><FumadocsPublicationI18n locale={locale} destinations={destinations}><DocsLayout tree={tree} links={formal?fumadocsMenuLinks(menu,locale):undefined} nav={{title:'JUYU Help Centre',url:root}} sidebar={formal?{footer:<FumadocsAccountFooter locale={locale}/>}:{}} searchToggle={{enabled:formal&&result.features.search}}>
  <DocsPage
   data-fumadocs-publication=""
   toc={document.toc}
   breadcrumb={{includeRoot:{url:root},includePage:true}}
  >
   <DocsTitle>{article.title}</DocsTitle>
   {article.description&&<DocsDescription>{article.description}</DocsDescription>}
   <FumadocsPublicationActions article={article} features={result.features} viewerId={result.viewerId} favorite={result.favorite}/>
   {formal&&result.features.recent&&<RecentRecorder documentId={article.id} revision={article.revision}/>}
   {formal&&result.features.analytics&&<ArticleAnalytics documentId={article.id} revision={article.revision}/>}
   <DocsBody><FumadocsBlockNoteReader blocks={document.blocks} published locale={locale} documentId={article.id} revision={article.revision} referencePages={referencePages(result.pages,mode)} referenceAliases={result.referenceAliases}/></DocsBody>
   <FumadocsPublicationFeedback article={article} features={result.features}/>
  </DocsPage>
 </DocsLayout></FumadocsPublicationI18n></FumadocsSearchProvider>;
}
