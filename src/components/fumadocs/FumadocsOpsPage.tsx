import type {Root} from 'fumadocs-core/page-tree';
import {RootProvider} from 'fumadocs-ui/provider/next';
import {DocsLayout} from 'fumadocs-ui/layouts/docs';
import {DocsBody,DocsDescription,DocsPage,DocsTitle} from 'fumadocs-ui/layouts/docs/page';
import type {MenuItem} from '../../navigation-settings/model';
import type {OpsPage} from '../../ops/model';
import {fumadocsMenuLinks} from '../../fumadocs/layout';
import {articleContentPath} from '../../reader/content-path';
import {OpsCollection} from '../ops/OpsCollection';
import {FumadocsAccountFooter} from './FumadocsAccountFooter';
import {FumadocsPublicationI18n} from './FumadocsPublicationI18n';
import '../../app/fumadocs-reader.css';

interface FumadocsOpsPageProps {
 data?:OpsPage;
 state:'ready'|'denied'|'unavailable';
 menu?:MenuItem[];
 search?:boolean;
 locale?:'zh-CN'|'en';
}

function opsTree(data:OpsPage|undefined):Root {
 return {name:'OPS Internal',children:[{
  type:'folder',name:'OPS Internal',root:true,defaultOpen:true,
  children:(data?.items??[]).map(item=>({type:'page' as const,$id:item.id,name:item.title,url:articleContentPath(item.id)})),
 }]};
}

function opsCopy(state:FumadocsOpsPageProps['state'],locale:'zh-CN'|'en'){
 const english=locale==='en';
 if(state==='denied')return {
  title:english?'You cannot access OPS Internal':'无法访问 OPS Internal',
  description:english?'Your access may have changed. Contact an administrator.':'当前账号没有阅读权限，或权限已发生变化。请联系管理员核对。',
 };
 if(state==='unavailable')return {
  title:english?'OPS Internal is unavailable':'OPS Internal 暂时无法读取',
  description:english?'Try again shortly. If the problem continues, contact an administrator.':'请稍后重试。如果持续失败，请联系管理员。',
 };
 return {
  title:'OPS Internal',
  description:english?'Published guidance for internal operations, exceptions, and escalations.':'查阅已发布的运营流程、异常处理和升级处理资料。',
 };
}

export function FumadocsOpsContent({data,state,menu=[],search=false,locale='zh-CN'}:FumadocsOpsPageProps){
 const copy=opsCopy(state,locale);
 return <FumadocsPublicationI18n locale={locale}><DocsLayout
  tree={opsTree(state==='ready'?data:undefined)}
  links={fumadocsMenuLinks(menu,locale)}
  nav={{title:'JUYU Help Centre',url:locale==='en'?'/help-centre?lang=en':'/help-centre'}}
  sidebar={{footer:<FumadocsAccountFooter locale={locale}/>}}
  searchToggle={{enabled:search}}
 >
  <DocsPage data-fumadocs-ops-page="" toc={[]} breadcrumb={{enabled:false}} tableOfContent={{enabled:false}} tableOfContentPopover={{enabled:false}} footer={{enabled:false}}>
   <DocsTitle>{copy.title}</DocsTitle>
   <DocsDescription>{copy.description}</DocsDescription>
   <DocsBody><div className="not-prose fumadocs-ops-content"><OpsCollection data={data} state={state} locale={locale} withinDocsPage/></div></DocsBody>
  </DocsPage>
 </DocsLayout></FumadocsPublicationI18n>;
}

export function FumadocsOpsPage(props:FumadocsOpsPageProps){
 return <RootProvider search={{options:{api:'/api/fumadocs-search'}}}><FumadocsOpsContent {...props}/></RootProvider>;
}
