import type {Root} from 'fumadocs-core/page-tree';
import {buttonVariants} from 'fumadocs-ui/components/ui/button';
import {DocsLayout} from 'fumadocs-ui/layouts/docs';
import {DocsBody,DocsDescription,DocsPage,DocsTitle} from 'fumadocs-ui/layouts/docs/page';
import {RootProvider} from 'fumadocs-ui/provider/next';
import Link from 'next/link';
import type {MenuItem} from '../../navigation-settings/model';
import type {PDFSnapshot} from '../../pdf/model';
import {articleContentPath} from '../../reader/content-path';
import {fumadocsMenuLinks} from '../../fumadocs/layout';
import {PDFPage} from '../gitbook/PDF/PDFPage';
import {FumadocsAccountFooter} from './FumadocsAccountFooter';
import {FumadocsPublicationI18n} from './FumadocsPublicationI18n';
import '../../app/fumadocs-reader.css';

interface FumadocsPDFPageProps {
 snapshot?:PDFSnapshot;
 state:'ready'|'disabled'|'unavailable';
 message?:string;
 menu?:MenuItem[];
 search?:boolean;
 locale?:'zh-CN'|'en';
}

function pdfTree(snapshot:PDFSnapshot|undefined,locale:'zh-CN'|'en'):Root {
 const name=locale==='en'?'PDF preview':'PDF 阅读';
 return {name,children:[{
  type:'folder',name,root:true,defaultOpen:true,
  children:snapshot?[{type:'page' as const,$id:snapshot.article.id,name:snapshot.article.title,url:articleContentPath(snapshot.article.id)}]:[],
 }]};
}

export function FumadocsPDFContent({snapshot,state,message,menu=[],search=false,locale='zh-CN'}:FumadocsPDFPageProps){
 const english=locale==='en',ready=state==='ready'&&snapshot!==undefined;
 const title=state==='disabled'?(english?'PDF export is turned off':'PDF 阅读／导出尚未开放'):english?'Read / export PDF':'PDF 阅读／导出';
 const description=ready
  ?`${snapshot.article.title} · ${english?(snapshot.article.publicationNumber?`Published version ${snapshot.article.publicationNumber}`:'Published content'):(snapshot.article.publicationNumber?`正式版本 ${snapshot.article.publicationNumber}`:'已发布内容')}`
  :(message??(english?'The PDF could not be opened. Please try again later.':'PDF 暂时无法读取，请稍后重试。'));
 return <FumadocsPublicationI18n locale={locale}><DocsLayout
  tree={pdfTree(ready?snapshot:undefined,locale)}
  links={fumadocsMenuLinks(menu,locale)}
  nav={{title:'JUYU Help Centre',url:locale==='en'?'/help-centre?lang=en':'/help-centre'}}
  sidebar={{footer:<FumadocsAccountFooter locale={locale}/>}}
  searchToggle={{enabled:search}}
 >
  <DocsPage data-fumadocs-pdf-page="" toc={[]} breadcrumb={{enabled:false}} tableOfContent={{enabled:false}} tableOfContentPopover={{enabled:false}} footer={{enabled:false}}>
   <div className="fumadocs-pdf-screen-heading"><DocsTitle>{title}</DocsTitle><DocsDescription>{description}</DocsDescription></div>
   <DocsBody><div className="not-prose fumadocs-pdf-content">{ready?<PDFPage snapshot={snapshot} withinDocsPage/>:<div role="status" className="space-y-4"><p>{description}</p><Link className={buttonVariants({variant:'outline'})} href={locale==='en'?'/help-centre?lang=en':'/help-centre'}>{english?'Back to Help Centre':'返回资料库'}</Link></div>}</div></DocsBody>
  </DocsPage>
 </DocsLayout></FumadocsPublicationI18n>;
}

export function FumadocsPDFPage(props:FumadocsPDFPageProps){
 return <RootProvider theme={{enabled:false}} search={{options:{api:'/api/fumadocs-search'}}}><FumadocsPDFContent {...props}/></RootProvider>;
}
