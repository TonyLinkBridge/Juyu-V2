import type {Root} from 'fumadocs-core/page-tree';
import {DocsLayout} from 'fumadocs-ui/layouts/docs';
import {DocsBody,DocsDescription,DocsPage,DocsTitle} from 'fumadocs-ui/layouts/docs/page';
import type {MenuItem} from '../../navigation-settings/model';
import type {QaPage} from '../../qa/model';
import type {Publication} from '../../reader/body';
import {QaView} from '../qa/QaView';
import {FumadocsAccountFooter} from './FumadocsAccountFooter';
import {FumadocsPublicationI18n} from './FumadocsPublicationI18n';
import {FumadocsSearchProvider} from './FumadocsSearchProvider';
import '../../app/fumadocs-reader.css';

interface FumadocsQaPageProps {
 data?:QaPage;
 initialAnswer?:Publication;
 viewerId?:string;
 state:'ready'|'denied'|'unavailable'|'invalid';
 menu?:MenuItem[];
 searchEnabled?:boolean;
 locale?:'zh-CN'|'en';
}

function qaHref(id:string,locale:'zh-CN'|'en'){
 return `/help-centre/qa?question=${encodeURIComponent(id)}${locale==='en'?'&lang=en':''}#qa-${encodeURIComponent(id)}`;
}

function qaTree(data:QaPage|undefined,locale:'zh-CN'|'en'):Root {
 const name=locale==='en'?'Q&A':'Q&A 问答';
 return {name,children:[{
  type:'folder',name,root:true,defaultOpen:true,
  children:(data?.items??[]).map(item=>({type:'page' as const,$id:item.id,name:item.title,url:qaHref(item.id,locale)})),
 }]};
}

function qaCopy(state:FumadocsQaPageProps['state'],locale:'zh-CN'|'en'){
 const english=locale==='en';
 if(state==='denied')return {
  title:english?'You cannot access Q&A':'无法访问 Q&A 问答',
  description:english?'Check your company account or contact an administrator.':'请确认公司账号，或联系管理员核对阅读权限。',
 };
 if(state==='invalid')return {
  title:english?'Invalid Q&A filter':'问答筛选条件无效',
  description:english?'Clear the filter and try again.':'请清除筛选后重新查看问答。',
 };
 if(state==='unavailable')return {
  title:english?'Q&A is unavailable':'Q&A 问答暂时无法读取',
  description:english?'Try again shortly. If the problem continues, contact an administrator.':'请稍后重新读取；如果持续失败，请联系管理员。',
 };
 return {
  title:english?'Q&A':'Q&A 问答',
  description:english?'Find a question and open its reviewed, published answer.':'查找问题，展开查看已审核发布的标准答案。',
 };
}

export function FumadocsQaContent({data,initialAnswer,viewerId,state,searchEnabled=true,locale='zh-CN'}:FumadocsQaPageProps){
 const copy=qaCopy(state,locale);
 return <FumadocsPublicationI18n locale={locale}><DocsLayout
  tree={qaTree(state==='ready'?data:undefined,locale)}
  nav={{title:'JUYU Help Centre',url:locale==='en'?'/help-centre?lang=en':'/help-centre'}}
  sidebar={{footer:<FumadocsAccountFooter locale={locale}/>}}
  searchToggle={{enabled:searchEnabled}}
 >
  <DocsPage data-fumadocs-qa-page="" toc={[]} breadcrumb={{enabled:false}} tableOfContent={{enabled:false}} tableOfContentPopover={{enabled:false}} footer={{enabled:false}}>
   <DocsTitle>{copy.title}</DocsTitle>
   <DocsDescription>{copy.description}</DocsDescription>
   <DocsBody><div className="not-prose fumadocs-qa-content"><QaView searchEnabled={searchEnabled} data={data} state={state} viewerId={viewerId} initialAnswer={initialAnswer} locale={locale} withinDocsPage/></div></DocsBody>
  </DocsPage>
 </DocsLayout></FumadocsPublicationI18n>;
}

export function FumadocsQaPage(props:FumadocsQaPageProps){
 return <FumadocsSearchProvider locale={props.locale}><FumadocsQaContent {...props}/></FumadocsSearchProvider>;
}
