import {RootProvider} from 'fumadocs-ui/provider/next';
import {DocsLayout} from 'fumadocs-ui/layouts/docs';
import {DocsBody,DocsDescription,DocsPage,DocsTitle} from 'fumadocs-ui/layouts/docs/page';
import type {FeatureFlags} from '../../features/model';
import type {MenuItem} from '../../navigation-settings/model';
import type {SearchScope,TitleSearch} from '../../reader/search';
import type {NavigationNode} from '../../reader/tree';
import {fumadocsMenuLinks} from '../../fumadocs/layout';
import {fumadocsPublicationTree,type FumadocsPublicationLocale} from '../../fumadocs/publication';
import {SearchAnalytics} from '../analytics/SearchAnalytics';
import {SearchResultsBody} from '../gitbook/Search/SearchResults';
import {AccountMenu} from '../shell/AdminFrame';
import {FumadocsPublicationI18n} from './FumadocsPublicationI18n';
import '../../app/fumadocs-reader.css';

export interface FumadocsSearchPageProps {
 pages:NavigationNode[];
 menu?:MenuItem[];
 features:Pick<FeatureFlags,'search'|'analytics'>;
 search:TitleSearch;
 scope:SearchScope;
 failed?:boolean;
 retryHref:string;
 locale?:FumadocsPublicationLocale;
}

export function FumadocsSearchContent({pages,menu=[],features,search,scope,failed=false,retryHref,locale='zh-CN'}:FumadocsSearchPageProps){
 const english=locale==='en';
 return <FumadocsPublicationI18n locale={locale}><DocsLayout
  tree={fumadocsPublicationTree(failed?[]:pages,locale,'formal')}
  links={fumadocsMenuLinks(menu,locale)}
  nav={{title:'JUYU Help Centre',url:'/help-centre',children:<div className="fumadocs-account"><AccountMenu enabled locale={locale} accountOnly/></div>}}
  searchToggle={{enabled:features.search}}
 >
  <DocsPage data-fumadocs-search-page="" toc={[]} breadcrumb={{enabled:false}} tableOfContent={{enabled:false}} tableOfContentPopover={{enabled:false}} footer={{enabled:false}}>
   <DocsTitle>{english?'Search results':'搜索结果'}</DocsTitle>
   <DocsDescription>{english?'Search published content you can access by title, tag, or content.':'搜索你有权阅读的已发布资料：标题、标签和正文。'}</DocsDescription>
   <DocsBody><div className="not-prose fumadocs-search-results"><SearchAnalytics search={search} enabled={!failed&&features.analytics}><SearchResultsBody search={search} scope={scope} failed={failed} retryHref={retryHref} locale={locale}/></SearchAnalytics></div></DocsBody>
  </DocsPage>
 </DocsLayout></FumadocsPublicationI18n>;
}

export function FumadocsSearchPage(props:FumadocsSearchPageProps){
 return <RootProvider search={{options:{api:'/api/fumadocs-search'}}}><FumadocsSearchContent {...props}/></RootProvider>;
}
