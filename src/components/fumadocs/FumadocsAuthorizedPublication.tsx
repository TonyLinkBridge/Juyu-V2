import {FumadocsDocsLayout as DocsLayout} from './FumadocsDocsLayout';
import {notFound,redirect} from 'next/navigation';
import {applicationAuthorization} from '../../server/authorization/application';
import {canonicalFumadocsPublicationPath,formalFumadocsPublicationPath,fumadocsPublicationLanguages,fumadocsPublicationTree,type FumadocsPublicationSection,type FumadocsReaderMode} from '../../fumadocs/publication';
import type {NavigationPage} from '../../reader/navigation';
import type {NavigationNode} from '../../reader/tree';
import {FumadocsPublicationI18n} from './FumadocsPublicationI18n';
import {FumadocsAccountFooter} from './FumadocsAccountFooter';
import {FumadocsSearchProvider} from './FumadocsSearchProvider';
import {fumadocsContentTabs} from '../../fumadocs/tabs';
import {readReaderPresentation} from '../../server/reader-presentation';
import {FumadocsPublicationPage} from './FumadocsPublicationPage';
import {publicationPathValue} from '../../fumadocs/slugs';

const previewRoot='/design-preview/fumadocs-reader';

function referencePages(nodes:NavigationNode[],mode:FumadocsReaderMode,section:FumadocsPublicationSection):NavigationPage[]{
 const pages:NavigationPage[]=[],seen=new Set<string>();
 const visit=(items:NavigationNode[])=>{for(const item of items){
  if(item.type==='group')visit(item.descendants);
  else if(!seen.has(item.id)){
   seen.add(item.id);
   pages.push({...item,href:mode==='formal'?formalFumadocsPublicationPath(item.slug??item.id,section):canonicalFumadocsPublicationPath(item.id)});
  }
 }};
 visit(nodes);
 return pages;
}

export async function FumadocsAuthorizedPublication({articleId,mode='preview',routeSection}:{articleId:string;mode?:FumadocsReaderMode;routeSection?:FumadocsPublicationSection}){
 const formal=mode==='formal';
 let requestedArticleId=articleId;
 if(formal)try{requestedArticleId=publicationPathValue(articleId);}catch{notFound();}
 if(!requestedArticleId.trim()||requestedArticleId.length>(formal?250:200))notFound();
 let result:Awaited<ReturnType<Awaited<ReturnType<typeof applicationAuthorization>>['reader']>>;
 try{
  const authorization=await applicationAuthorization();
  if(!formal)await authorization.requireEditorAdmin();
  result=await authorization.reader(requestedArticleId,formal?routeSection:undefined);
 }catch{notFound();}
 if(result.destination)redirect(result.destination);
 if(!result.article)notFound();
 const article=result.article;
 const section:FumadocsPublicationSection=result.section==='ops'?'ops':'article';
 const canonicalPath=formalFumadocsPublicationPath(article.slug??article.id,section);
 if(formal&&((routeSection&&routeSection!==section)||requestedArticleId!==(article.slug??article.id)))redirect(canonicalPath);
 const locale=article.locale==='en'?'en':'zh-CN';
 const tree=fumadocsPublicationTree(result.pages,locale,mode,section);
 const destinations=fumadocsPublicationLanguages(article,mode,section);
 const navRoot=formal?'/help-centre':previewRoot;
 const activePath=section==='ops'?'/help-centre/ops':'/help-centre/library';
 let menu:Awaited<ReturnType<typeof readReaderPresentation>>['items']=[];
 let knowledgeEntry:string|undefined;
 if(formal)try{const presentation=await readReaderPresentation(locale);menu=presentation.items;knowledgeEntry=presentation.knowledgeEntry;}catch{}
 return <FumadocsSearchProvider locale={locale}><FumadocsPublicationI18n locale={locale} destinations={destinations}><DocsLayout tree={tree} tabs={formal?fumadocsContentTabs(menu,locale,{path:activePath,pathname:canonicalPath},knowledgeEntry):false} nav={{title:'JUYU Help Centre',url:navRoot}} sidebar={formal?{prefetch:false,footer:<FumadocsAccountFooter locale={locale}/>}:{prefetch:false}} searchToggle={{enabled:formal&&result.features.search}}>
  <FumadocsPublicationPage article={article} features={result.features} viewerId={result.viewerId} favorite={result.favorite} formal={formal} recentKind={section} referencePages={referencePages(result.pages,mode,section)} referenceAliases={result.referenceAliases}/>
 </DocsLayout></FumadocsPublicationI18n></FumadocsSearchProvider>;
}
