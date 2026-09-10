import {PageTags} from './PageTags';
import Link from 'next/link';
// Adapted from GitBook PageHeader's nav/ol/ancestor/separator and heading branches.
// Classification groups currently have no standalone pages; render honest labels.
import type {Publication} from '../../../reader/body';
import type {PageNavigation} from '../../../reader/page-navigation';
export function PageHeader({article,navigation}:{article:Publication;navigation:PageNavigation}) {
 return <header className="gitbook-page-header">
   <nav aria-label="面包屑" className="reader-breadcrumbs"><ol>
     <li><Link prefetch={false} href="/help-centre">帮助中心</Link><BreadcrumbSeparator/></li>
     {navigation.ancestors.map(ancestor=><li key={ancestor.id}><span>{ancestor.title}</span><BreadcrumbSeparator/></li>)}
     <li><span aria-current="page">{article.title}</span></li>
   </ol></nav>
   <p className="reader-eyebrow">员工资料库 · 已发布</p>
   <PageTags tags={article.tags}/>
   <h1 id="reader-page-title" tabIndex={-1}>{article.title}</h1><p className="reader-version">正式版本 {article.revision}</p>
 </header>;
}
function BreadcrumbSeparator(){return <span className="breadcrumb-separator" aria-hidden="true">›</span>;}
