import type {Root} from 'fumadocs-core/page-tree';
import {Card,Cards} from 'fumadocs-ui/components/card';
import {buttonVariants} from 'fumadocs-ui/components/ui/button';
import {DocsLayout} from 'fumadocs-ui/layouts/docs';
import {DocsBody,DocsDescription,DocsPage,DocsTitle} from 'fumadocs-ui/layouts/docs/page';
import {RootProvider} from 'fumadocs-ui/provider/next';
import Link from 'next/link';
import type {ContentKind} from '../../domain/model';
import type {MenuItem} from '../../navigation-settings/model';
import {contentPath} from '../../reader/content-path';
import {fumadocsMenuLinks} from '../../fumadocs/layout';
import {AccountMenu} from '../shell/AdminFrame';
import {FumadocsPublicationI18n} from './FumadocsPublicationI18n';
import '../../app/fumadocs-reader.css';

export interface ChangelogPageData {
 items:{id:string;kind:ContentKind;title:string;at:string;publicationNumber:number|null;releaseNote:string}[];
 page:number;
 hasMore:boolean;
}

interface FumadocsChangelogPageProps {
 data?:ChangelogPageData;
 state:'ready'|'unavailable';
 menu?:MenuItem[];
 search?:boolean;
 locale?:'zh-CN'|'en';
}

function changelogTree(data:ChangelogPageData|undefined,locale:'zh-CN'|'en'):Root {
 const name=locale==='en'?"What's new":'更新日志';
 return {name,children:[{
  type:'folder',name,root:true,defaultOpen:true,
  children:(data?.items??[]).map(item=>({type:'page' as const,$id:item.id,name:item.title,url:contentPath(item.kind,item.id,locale)})),
 }]};
}

function pageHref(page:number,locale:'zh-CN'|'en'){
 const params=new URLSearchParams();
 if(locale==='en')params.set('lang','en');
 if(page>1)params.set('page',String(page));
 const query=params.toString();
 return `/help-centre/changelog${query?`?${query}`:''}`;
}

function itemType(kind:ContentKind,english:boolean){
 if(english)return {article:'Article',ops:'OPS Internal',reference:'Reference',qa:'Q&A'}[kind];
 return kind==='qa'?'Q&A':kind==='ops'?'OPS Internal':kind==='reference'?'Reference':'知识文章';
}

export function FumadocsChangelogContent({data,state,menu=[],search=false,locale='zh-CN'}:FumadocsChangelogPageProps){
 const english=locale==='en',ready=state==='ready'&&data!==undefined;
 const title=english?"What's new":'更新日志';
 const description=english?'Published updates you can currently access, newest first.':'按正式发布时间排列当前可阅读的资料。仅显示你有权限查看的已发布版本。';
 const formatter=new Intl.DateTimeFormat(english?'en-MY':'zh-CN',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'long',day:'numeric'});
 const currentPage=data?.page??1;
 return <FumadocsPublicationI18n locale={locale} destinations={{'zh-CN':pageHref(currentPage,'zh-CN'),en:pageHref(currentPage,'en')}}><DocsLayout
  tree={changelogTree(ready?data:undefined,locale)}
  links={fumadocsMenuLinks(menu,locale)}
  nav={{title:'JUYU Help Centre',url:locale==='en'?'/help-centre?lang=en':'/help-centre',children:<div className="fumadocs-account"><AccountMenu enabled locale={locale} accountOnly/></div>}}
  searchToggle={{enabled:search}}
 >
  <DocsPage data-fumadocs-changelog-page="" toc={[]} breadcrumb={{enabled:false}} tableOfContent={{enabled:false}} tableOfContentPopover={{enabled:false}} footer={{enabled:false}}>
   <DocsTitle>{title}</DocsTitle>
   <DocsDescription>{description}</DocsDescription>
   <DocsBody><section className="not-prose" aria-label={english?'Published updates':'正式更新'}>
    {!ready?<div role="alert" className="space-y-4"><p>{english?'Updates are unavailable right now.':'更新日志暂时无法读取。'}</p><Link className={buttonVariants({variant:'outline'})} href={pageHref(1,locale)}>{english?'Try again':'重新读取'}</Link></div>
    :data.items.length===0?<p role="status">{english?'No published updates are available yet.':'目前没有可阅读的正式更新。'}</p>
    :<Cards className="grid-cols-1" aria-label={english?'Published updates list':'正式更新列表'}>{data.items.map(item=><Card
      key={item.id}
      href={contentPath(item.kind,item.id,locale)}
      title={item.title}
      description={<span className="flex flex-col gap-2"><span><time dateTime={item.at}>{formatter.format(new Date(item.at))}</time> · {itemType(item.kind,english)} · {english?(item.publicationNumber?`Version ${item.publicationNumber}`:'Published'):(item.publicationNumber?`正式版本 ${item.publicationNumber}`:'已发布')}</span>{item.releaseNote&&<span className="whitespace-pre-wrap text-fd-foreground">{item.releaseNote}</span>}</span>}
     />)}</Cards>}
    {ready&&(data.page>1||data.hasMore)&&<nav className="mt-6 flex gap-3" aria-label={english?'Updates pages':'更新日志分页'}>
     {data.page>1&&<Link className={buttonVariants({variant:'outline'})} href={pageHref(data.page-1,locale)}>{english?'Previous':'上一页'}</Link>}
     {data.hasMore&&<Link className={buttonVariants({variant:'outline'})} href={pageHref(data.page+1,locale)}>{english?'Next':'下一页'}</Link>}
    </nav>}
   </section></DocsBody>
  </DocsPage>
 </DocsLayout></FumadocsPublicationI18n>;
}

export function FumadocsChangelogPage(props:FumadocsChangelogPageProps){
 return <RootProvider search={{options:{api:'/api/fumadocs-search'}}}><FumadocsChangelogContent {...props}/></RootProvider>;
}
