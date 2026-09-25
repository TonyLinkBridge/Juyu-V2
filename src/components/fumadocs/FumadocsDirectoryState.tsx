import {RootProvider} from 'fumadocs-ui/provider/next';
import {DocsLayout} from 'fumadocs-ui/layouts/docs';
import {DocsBody,DocsDescription,DocsPage,DocsTitle} from 'fumadocs-ui/layouts/docs/page';
import {buttonVariants} from 'fumadocs-ui/components/ui/button';
import Link from 'next/link';
import type {FeatureFlags} from '../../features/model';
import type {MenuItem} from '../../navigation-settings/model';
import type {NavigationNode} from '../../reader/tree';
import {fumadocsMenuLinks} from '../../fumadocs/layout';
import {fumadocsPublicationTree,type FumadocsPublicationLocale} from '../../fumadocs/publication';
import {FumadocsAccountFooter} from './FumadocsAccountFooter';
import {FumadocsPublicationI18n} from './FumadocsPublicationI18n';
import '../../app/fumadocs-reader.css';

interface DirectoryStateProps {
 pages:NavigationNode[];
 menu?:MenuItem[];
 features?:Pick<FeatureFlags,'search'>;
 requested?:string|string[];
 failed?:boolean;
 locale?:FumadocsPublicationLocale;
 title?:string;
 description?:string;
 retryHref?:string;
}

function directoryCopy({failed,requested,pages,locale,title,description}:{failed:boolean;requested:DirectoryStateProps['requested'];pages:NavigationNode[];locale:FumadocsPublicationLocale;title?:string;description?:string}){
 if(title&&description)return {title,description};
 const english=locale==='en',unavailable=!failed&&requested!==undefined;
 if(failed)return {
  title:english?'The article directory is unavailable':'目录暂时无法加载',
  description:english?'We couldn’t load the article directory. Please try again.':'暂时无法取得资料目录，请重新加载。若持续失败，请联系管理员。',
 };
 if(unavailable)return {
  title:english?'This article is unavailable':'文章暂不可用',
  description:english?'You can choose another published article from the directory.':'该文章目前无法阅读。你可以从目录选择其他已发布资料。',
 };
 return {
  title:english?'Welcome to the Help Centre':'欢迎使用资料库',
  description:english?(pages.length?'Choose an article from the directory.':'Published articles you can read will appear here.'):(pages.length?'从资料目录选择你需要的资料。':'有你可以阅读的文章发布后，会显示在这里。'),
 };
}

export function FumadocsDirectoryContent({pages,menu=[],features,requested,failed=false,locale='zh-CN',title,description,retryHref}:DirectoryStateProps){
 const copy=directoryCopy({failed,requested,pages,locale,title,description});
 const root='/help-centre';
 return <FumadocsPublicationI18n locale={locale}><DocsLayout
  tree={fumadocsPublicationTree(failed?[]:pages,locale,'formal')}
  links={fumadocsMenuLinks(menu,locale)}
  nav={{title:'JUYU Help Centre',url:root}}
  sidebar={{footer:<FumadocsAccountFooter locale={locale}/>}}
  searchToggle={{enabled:Boolean(features?.search)}}
 >
  <DocsPage data-fumadocs-directory-state="" toc={[]} breadcrumb={{enabled:false}} tableOfContent={{enabled:false}} tableOfContentPopover={{enabled:false}} footer={{enabled:false}}>
   <DocsTitle>{copy.title}</DocsTitle>
   <DocsDescription>{copy.description}</DocsDescription>
   {failed&&<DocsBody><Link className={buttonVariants({variant:'outline'})} href={retryHref??(locale==='en'?'/help-centre/library?lang=en':'/help-centre/library')}>{locale==='en'?'Try again':'重新加载'}</Link></DocsBody>}
  </DocsPage>
 </DocsLayout></FumadocsPublicationI18n>;
}

export function FumadocsDirectoryState(props:DirectoryStateProps){
 return <RootProvider theme={{enabled:false}} search={{options:{api:'/api/fumadocs-search'}}}><FumadocsDirectoryContent {...props}/></RootProvider>;
}
