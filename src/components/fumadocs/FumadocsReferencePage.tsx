import type {Root} from 'fumadocs-core/page-tree';
import {RootProvider} from 'fumadocs-ui/provider/next';
import {DocsLayout} from 'fumadocs-ui/layouts/docs';
import {DocsBody,DocsDescription,DocsPage,DocsTitle} from 'fumadocs-ui/layouts/docs/page';
import type {MenuItem} from '../../navigation-settings/model';
import type {ReferenceDetail,ReferencePage} from '../../reference/model';
import {fumadocsMenuLinks} from '../../fumadocs/layout';
import {ReferenceView} from '../reference/ReferenceView';
import {FumadocsAccountFooter} from './FumadocsAccountFooter';
import {FumadocsPublicationI18n} from './FumadocsPublicationI18n';
import '../../app/fumadocs-reader.css';

interface FumadocsReferencePageProps {
 data?:ReferencePage;
 detail?:ReferenceDetail;
 state:'ready'|'denied'|'unavailable';
 detailState?:'idle'|'ready'|'unavailable';
 menu?:MenuItem[];
 search?:boolean;
 locale?:'zh-CN'|'en';
}

function referenceHref(id:string,page:number,locale:'zh-CN'|'en'){
 return `/help-centre/reference?page=${page}&article=${encodeURIComponent(id)}${locale==='en'?'&lang=en':''}#reference-detail`;
}

function referenceTree(data:ReferencePage|undefined,locale:'zh-CN'|'en'):Root {
 const name=locale==='en'?'Reference':'Reference 速查';
 return {name,children:[{
  type:'folder',name,root:true,defaultOpen:true,
  children:(data?.items??[]).map(item=>({type:'page' as const,$id:item.id,name:item.title,url:referenceHref(item.id,data?.page??1,locale)})),
 }]};
}

function referenceCopy(state:FumadocsReferencePageProps['state'],locale:'zh-CN'|'en'){
 const english=locale==='en';
 if(state==='denied')return {
  title:english?'You cannot access Reference':'无法访问 Reference 速查',
  description:english?'Your access may have changed. Contact an administrator.':'当前账号没有阅读权限，或权限已发生变化。请联系管理员核对。',
 };
 if(state==='unavailable')return {
  title:english?'Reference is unavailable':'Reference 速查暂时无法读取',
  description:english?'Try again. If the problem continues, contact an administrator.':'请重新载入；如果持续失败，请联系管理员。',
 };
 return {
  title:english?'Reference':'Reference 速查',
  description:english?'Check published tables for fees, registrars, and business rules you can access.':'查阅有权阅读的正式表格，快速查找费用、注册商和业务规则。',
 };
}

export function FumadocsReferenceContent({data,detail,state,detailState='idle',menu=[],search=false,locale='zh-CN'}:FumadocsReferencePageProps){
 const copy=referenceCopy(state,locale);
 return <FumadocsPublicationI18n locale={locale}><DocsLayout
  tree={referenceTree(state==='ready'?data:undefined,locale)}
  links={fumadocsMenuLinks(menu,locale)}
  nav={{title:'JUYU Help Centre',url:locale==='en'?'/help-centre?lang=en':'/help-centre'}}
  sidebar={{footer:<FumadocsAccountFooter locale={locale}/>}}
  searchToggle={{enabled:search}}
 >
  <DocsPage data-fumadocs-reference-page="" toc={[]} breadcrumb={{enabled:false}} tableOfContent={{enabled:false}} tableOfContentPopover={{enabled:false}} footer={{enabled:false}}>
   <DocsTitle>{copy.title}</DocsTitle>
   <DocsDescription>{copy.description}</DocsDescription>
   <DocsBody><div className="not-prose fumadocs-reference-content"><ReferenceView data={data} detail={detail} state={state} detailState={detailState} locale={locale} withinDocsPage/></div></DocsBody>
  </DocsPage>
 </DocsLayout></FumadocsPublicationI18n>;
}

export function FumadocsReferencePage(props:FumadocsReferencePageProps){
 return <RootProvider theme={{enabled:false}} search={{options:{api:'/api/fumadocs-search'}}}><FumadocsReferenceContent {...props}/></RootProvider>;
}
