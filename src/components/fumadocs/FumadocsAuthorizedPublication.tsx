import {DocsLayout} from 'fumadocs-ui/layouts/docs';
import {DocsBody,DocsDescription,DocsPage,DocsTitle} from 'fumadocs-ui/layouts/docs/page';
import {notFound,redirect} from 'next/navigation';
import {applicationAuthorization} from '../../server/authorization/application';
import {canonicalFumadocsPublicationPath,formalFumadocsPublicationPath,fumadocsPublication,fumadocsPublicationLanguages,fumadocsPublicationTree,type FumadocsPublicationSection,type FumadocsReaderMode} from '../../fumadocs/publication';
import type {NavigationPage} from '../../reader/navigation';
import type {NavigationNode} from '../../reader/tree';
import {FumadocsBlockNoteReader} from './FumadocsBlockNoteReader';
import {FumadocsPublicationI18n} from './FumadocsPublicationI18n';
import {FumadocsPublicationActions,FumadocsPublicationFeedback} from './FumadocsPublicationActions';
import {ArticleAnalytics} from '../analytics/ArticleAnalytics';
import {RecentRecorder} from '../recent/RecentRecorder';
import {FumadocsAccountFooter} from './FumadocsAccountFooter';
import {FumadocsSearchProvider} from './FumadocsSearchProvider';
import {fumadocsBlockNoteTocSlots} from './FumadocsBlockNoteTocBridge';
import {fumadocsContentTabs} from '../../fumadocs/tabs';
import {readReaderPresentation} from '../../server/reader-presentation';

const previewRoot='/design-preview/fumadocs-reader';

function referencePages(nodes:NavigationNode[],mode:FumadocsReaderMode,section:FumadocsPublicationSection):NavigationPage[]{
 const pages:NavigationPage[]=[],seen=new Set<string>();
 const visit=(items:NavigationNode[])=>{for(const item of items){
  if(item.type==='group')visit(item.descendants);
  else if(!seen.has(item.id)){
   seen.add(item.id);
   pages.push({...item,href:mode==='formal'?formalFumadocsPublicationPath(item.id,section):canonicalFumadocsPublicationPath(item.id)});
  }
 }};
 visit(nodes);
 return pages;
}

export async function FumadocsAuthorizedPublication({articleId,mode='preview',routeSection}:{articleId:string;mode?:FumadocsReaderMode;routeSection?:FumadocsPublicationSection}){
 if(!articleId.trim()||articleId.length>200)notFound();
 const formal=mode==='formal';
 let result:Awaited<ReturnType<Awaited<ReturnType<typeof applicationAuthorization>>['reader']>>;
 try{
  const authorization=await applicationAuthorization();
  if(!formal)await authorization.requireEditorAdmin();
  result=await authorization.reader(articleId);
 }catch{notFound();}
 if(result.destination)redirect(result.destination);
 if(!result.article)notFound();
 const article=result.article;
 const section:FumadocsPublicationSection=result.section==='ops'?'ops':'article';
 if(formal&&routeSection&&routeSection!==section)redirect(formalFumadocsPublicationPath(article.id,section));
 const locale=article.locale==='en'?'en':'zh-CN';
 const document=fumadocsPublication(article);
 const tree=fumadocsPublicationTree(result.pages,locale,mode,section);
 const destinations=fumadocsPublicationLanguages(article,mode,section);
 const navRoot=formal?'/help-centre':previewRoot;
 const sectionRoot=formal&&section==='ops'?'/help-centre/ops':navRoot;
 const activePath=section==='ops'?'/help-centre/ops':'/help-centre/library';
 let menu:Awaited<ReturnType<typeof readReaderPresentation>>['items']=[];
 let knowledgeEntry:string|undefined;
 if(formal)try{const presentation=await readReaderPresentation(locale);menu=presentation.items;knowledgeEntry=presentation.knowledgeEntry;}catch{}
 return <FumadocsSearchProvider locale={locale}><FumadocsPublicationI18n locale={locale} destinations={destinations}><DocsLayout tree={tree} tabs={formal?fumadocsContentTabs(menu,locale,{path:activePath,pathname:formalFumadocsPublicationPath(article.id,section)},knowledgeEntry):false} nav={{title:'JUYU Help Centre',url:navRoot}} sidebar={formal?{footer:<FumadocsAccountFooter locale={locale}/>}:{}} searchToggle={{enabled:formal&&result.features.search}}>
  <DocsPage
   data-fumadocs-publication=""
   toc={document.toc}
   slots={{toc:fumadocsBlockNoteTocSlots}}
   breadcrumb={{includeRoot:{url:sectionRoot},includePage:true}}
  >
   <DocsTitle>{article.title}</DocsTitle>
   {article.description&&<DocsDescription>{article.description}</DocsDescription>}
   <FumadocsPublicationActions article={article} features={result.features} viewerId={result.viewerId} favorite={result.favorite}/>
   {formal&&result.features.recent&&<RecentRecorder documentId={article.id} revision={article.revision} kind={section}/>}
   {formal&&result.features.analytics&&<ArticleAnalytics documentId={article.id} revision={article.revision}/>}
   <DocsBody><FumadocsBlockNoteReader blocks={document.blocks} published locale={locale} documentId={article.id} revision={article.revision} referencePages={referencePages(result.pages,mode,section)} referenceAliases={result.referenceAliases}/></DocsBody>
   <FumadocsPublicationFeedback article={article} features={result.features}/>
  </DocsPage>
 </DocsLayout></FumadocsPublicationI18n></FumadocsSearchProvider>;
}
