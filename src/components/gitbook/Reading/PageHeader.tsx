import {PageTags} from './PageTags';
import Link from 'next/link';
// Adapted from GitBook PageHeader's nav/ol/ancestor/separator and heading branches.
// Classification groups currently have no standalone pages; render honest labels.
import type {Publication} from '../../../reader/body';
import type {PageNavigation} from '../../../reader/page-navigation';
export function PageHeader({section,article,navigation}:{section?:'ops';article:Publication;navigation:PageNavigation}) {
 return <header className="gitbook-page-header">
   <nav aria-label="面包屑" className="reader-breadcrumbs"><ol>
     <li><Link prefetch={false} href={section==='ops'?'/help-centre/ops':'/help-centre/library'}>{section==='ops'?'OPS Internal':'资料目录'}</Link><BreadcrumbSeparator/></li>
     {navigation.ancestors.map(ancestor=><li key={ancestor.id}><span>{ancestor.title}</span><BreadcrumbSeparator/></li>)}
     <li><span aria-current="page">{article.title}</span></li>
   </ol></nav>
   <p className="reader-eyebrow article-publication-status"><span aria-hidden="true"/> 已发布 · 正式资料</p>
   <PageTags tags={article.tags}/>
   <h1 id="reader-page-title" tabIndex={-1}>{article.title}</h1><p className="reader-version">正式版本 {article.revision}</p>
 </header>;
}
function BreadcrumbSeparator(){return <span className="breadcrumb-separator" aria-hidden="true">›</span>;}
