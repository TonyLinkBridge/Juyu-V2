import type {ReactNode} from 'react';
import type {Root} from 'fumadocs-core/page-tree';
import {DocsLayout} from 'fumadocs-ui/layouts/docs';
import {DocsBody,DocsDescription,DocsPage,DocsTitle} from 'fumadocs-ui/layouts/docs/page';
import type {FavoritesPage} from '../../favorites/model';
import type {MenuItem} from '../../navigation-settings/model';
import {contentPath} from '../../reader/content-path';
import {FavoritesCollection,FavoritesView} from '../favorites/FavoritesView';
import {FumadocsAccountFooter} from './FumadocsAccountFooter';
import {FumadocsPublicationI18n} from './FumadocsPublicationI18n';
import {FumadocsSearchProvider} from './FumadocsSearchProvider';
import '../../app/fumadocs-reader.css';

interface FumadocsFavoritesPageProps {
 data?:FavoritesPage;
 viewerId?:string;
 state:'ready'|'denied'|'unavailable'|'disabled';
 menu?:MenuItem[];
 search?:boolean;
 locale?:'zh-CN'|'en';
}

function favoritesTree(data:FavoritesPage|undefined,locale:'zh-CN'|'en'):Root {
 const name=locale==='en'?'Saved articles':'我的收藏';
 return {name,children:[{
  type:'folder',name,root:true,defaultOpen:true,
  children:(data?.items??[]).map(item=>({type:'page' as const,$id:item.id,name:item.title,url:contentPath(item.kind,item.id,locale)})),
 }]};
}

function favoritesCopy(state:FumadocsFavoritesPageProps['state'],locale:'zh-CN'|'en'){
 const english=locale==='en';
 if(state==='disabled')return {
  title:english?'Saved articles are turned off':'我的收藏尚未开放',
  description:english?'This feature is currently disabled. Contact an administrator if you need it.':'此功能目前已关闭；如需使用，请联系管理员。',
 };
 if(state==='denied')return {
  title:english?'Saved articles are unavailable':'收藏访问已暂停',
  description:english?'Your access may have changed. Contact an administrator.':'当前账号没有访问权限，或权限已发生变化。请联系管理员核对。',
 };
 if(state==='unavailable')return {
  title:english?'Could not load saved articles':'收藏暂时无法读取',
  description:english?'Try again. If the problem continues, contact an administrator.':'请重新读取；如果持续失败，请联系管理员。',
 };
 return {
  title:english?'Saved articles':'我的收藏',
  description:english?'Keep useful articles close at hand. This list shows the latest published versions you can access.':'保存常用资料，方便下次查阅。这里显示你目前有权阅读的最新正式版本。',
 };
}

function FavoritesShell({data,state,search=false,locale='zh-CN',children}:{children:ReactNode}&FumadocsFavoritesPageProps){
 const copy=favoritesCopy(state,locale);
 return <FumadocsPublicationI18n locale={locale}><DocsLayout
  tree={favoritesTree(state==='ready'?data:undefined,locale)}
  nav={{title:'JUYU Help Centre',url:locale==='en'?'/help-centre?lang=en':'/help-centre'}}
  sidebar={{footer:<FumadocsAccountFooter locale={locale}/>}}
  searchToggle={{enabled:search}}
 >
  <DocsPage data-fumadocs-favorites-page="" toc={[]} breadcrumb={{enabled:false}} tableOfContent={{enabled:false}} tableOfContentPopover={{enabled:false}} footer={{enabled:false}}>
   <DocsTitle>{copy.title}</DocsTitle>
   <DocsDescription>{copy.description}</DocsDescription>
   <DocsBody><div className="not-prose fumadocs-favorites-content">{children}</div></DocsBody>
  </DocsPage>
 </DocsLayout></FumadocsPublicationI18n>;
}

export function FumadocsFavoritesContent(props:FumadocsFavoritesPageProps){
 return <FavoritesShell {...props}><FavoritesView viewerId={props.viewerId} data={props.data} state={props.state} locale={props.locale} withinDocsPage/></FavoritesShell>;
}

/** Visual fixture only: the production component above always verifies the active Clerk session. */
export function FumadocsFavoritesPreviewContent(props:FumadocsFavoritesPageProps){
 return <FavoritesShell {...props}><FavoritesCollection viewerId={props.viewerId} data={props.data} state={props.state} locale={props.locale} withinDocsPage showControls={false}/></FavoritesShell>;
}

export function FumadocsFavoritesPage(props:FumadocsFavoritesPageProps){
 return <FumadocsSearchProvider locale={props.locale}><FumadocsFavoritesContent {...props}/></FumadocsSearchProvider>;
}
