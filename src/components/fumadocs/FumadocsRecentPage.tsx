import type {Root} from 'fumadocs-core/page-tree';
import {DocsLayout} from 'fumadocs-ui/layouts/docs';
import {DocsBody,DocsDescription,DocsPage,DocsTitle} from 'fumadocs-ui/layouts/docs/page';
import type {MenuItem} from '../../navigation-settings/model';
import type {RecentPage} from '../../recent/model';
import {contentPath} from '../../reader/content-path';
import {fumadocsMenuLinks} from '../../fumadocs/layout';
import {RecentView} from '../recent/RecentView';
import {FumadocsAccountFooter} from './FumadocsAccountFooter';
import {FumadocsPublicationI18n} from './FumadocsPublicationI18n';
import {FumadocsSearchProvider} from './FumadocsSearchProvider';
import '../../app/fumadocs-reader.css';

interface FumadocsRecentPageProps {
 data?:RecentPage;
 state:'ready'|'denied'|'unavailable'|'disabled';
 menu?:MenuItem[];
 search?:boolean;
 locale?:'zh-CN'|'en';
}

function recentTree(data:RecentPage|undefined,locale:'zh-CN'|'en'):Root {
 const name=locale==='en'?'Recently viewed':'最近浏览';
 return {name,children:[{
  type:'folder',name,root:true,defaultOpen:true,
  children:(data?.items??[]).map(item=>({type:'page' as const,$id:item.id,name:item.title,url:contentPath(item.kind,item.id,locale)})),
 }]};
}

function recentCopy(state:FumadocsRecentPageProps['state'],locale:'zh-CN'|'en'){
 const english=locale==='en';
 if(state==='disabled')return {
  title:english?'Recently viewed is turned off':'最近浏览尚未开放',
  description:english?'This feature is currently disabled. Contact an administrator if you need it.':'此功能目前已关闭；如需使用，请联系管理员。',
 };
 if(state==='denied')return {
  title:english?'Recently viewed is unavailable':'最近浏览访问已暂停',
  description:english?'Your access may have changed. Contact an administrator.':'当前账号没有访问权限，或权限已发生变化。请联系管理员核对。',
 };
 if(state==='unavailable')return {
  title:english?'Could not load recently viewed':'最近浏览暂时无法读取',
  description:english?'Try again. If the problem continues, contact an administrator.':'请重新读取；如果持续失败，请联系管理员。',
 };
 return {
  title:english?'Recently viewed':'最近浏览',
  description:english?'Pick up where you left off. This list holds up to 100 items and only shows published content you can still access.':'找回最近打开的资料。每人最多保留 100 篇，只显示你目前有权阅读的正式内容。',
 };
}

export function FumadocsRecentContent({data,state,menu=[],search=false,locale='zh-CN'}:FumadocsRecentPageProps){
 const copy=recentCopy(state,locale);
 return <FumadocsPublicationI18n locale={locale}><DocsLayout
  tree={recentTree(state==='ready'?data:undefined,locale)}
  links={fumadocsMenuLinks(menu,locale)}
  nav={{title:'JUYU Help Centre',url:locale==='en'?'/help-centre?lang=en':'/help-centre'}}
  sidebar={{footer:<FumadocsAccountFooter locale={locale}/>}}
  searchToggle={{enabled:search}}
 >
  <DocsPage data-fumadocs-recent-page="" toc={[]} breadcrumb={{enabled:false}} tableOfContent={{enabled:false}} tableOfContentPopover={{enabled:false}} footer={{enabled:false}}>
   <DocsTitle>{copy.title}</DocsTitle>
   <DocsDescription>{copy.description}</DocsDescription>
   <DocsBody><div className="not-prose fumadocs-recent-content"><RecentView data={data} state={state} locale={locale} withinDocsPage/></div></DocsBody>
  </DocsPage>
 </DocsLayout></FumadocsPublicationI18n>;
}

export function FumadocsRecentPage(props:FumadocsRecentPageProps){
 return <FumadocsSearchProvider locale={props.locale}><FumadocsRecentContent {...props}/></FumadocsSearchProvider>;
}
