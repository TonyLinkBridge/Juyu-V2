import {FileText} from '@phosphor-icons/react/dist/ssr';
import {ReaderIcon} from '../../../reader/icons';
import {PageTags} from './PageTags';
import Link from 'next/link';
// Adapted from GitBook PageHeader's nav/ol/ancestor/separator and heading branches.
// Classification groups currently have no standalone pages; render honest labels.
import type {Publication} from '../../../reader/body';
import type {PageNavigation} from '../../../reader/page-navigation';
import {NewVersionNotice} from './NewVersionNotice';
export function PageHeader({section,article,navigation}:{section?:'ops';article:Publication;navigation:PageNavigation}) {
 const english=article.locale==='en';
 return <header className="gitbook-page-header">
   <nav aria-label={english?'Breadcrumbs':'面包屑'} className="reader-breadcrumbs"><ol>
     <li><Link prefetch={false} href={section==='ops'?(english?'/help-centre/ops?lang=en':'/help-centre/ops'):english?'/help-centre/library?lang=en':'/help-centre/library'}>{section==='ops'?'OPS Internal':english?'Articles':'资料目录'}</Link>{navigation.ancestors.length>0&&<BreadcrumbSeparator/>}</li>
     {navigation.ancestors.map((ancestor,index)=><li key={ancestor.id}>{ancestor.siblings?.length?<details className="breadcrumb-shortcut"><summary aria-label={english?`Switch section: ${ancestor.title}`:`切换分类：${ancestor.title}`}>{ancestor.title}<span aria-hidden="true">⌄</span></summary><div className="breadcrumb-shortcut-menu">{ancestor.siblings.map(sibling=><Link prefetch={false} key={sibling.id} href={sibling.href} aria-current={sibling.id===ancestor.id?'page':undefined}>{sibling.title}</Link>)}</div></details>:<span>{ancestor.title}</span>}{index<navigation.ancestors.length-1&&<BreadcrumbSeparator/>}</li>)}

   </ol></nav>
   <p className="reader-eyebrow article-publication-status"><span aria-hidden="true"/> {english?'Published · Team knowledge':'已发布 · 正式资料'}</p>
   <PageTags tags={article.tags} locale={article.locale}/>
   <h1 id="reader-page-title" tabIndex={-1}>{article.iconKey?<ReaderIcon icon={article.iconKey} size={32} className="reader-title-icon"/>:<FileText className="reader-title-icon" size={32} aria-hidden="true"/>}<span>{article.title}</span></h1>{article.description&&<p className="reader-page-description">{article.description}</p>}<p className="reader-version">{english?(article.publicationNumber?`Published version ${article.publicationNumber}`:'Published'):(article.publicationNumber?`正式版本 ${article.publicationNumber}`:'已发布')}{article.publishedAt&&<> · <time dateTime={article.publishedAt}>{english?'Published ': '发布于 '}{new Intl.DateTimeFormat(english?'en-MY':'zh-CN',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'long',day:'numeric'}).format(new Date(article.publishedAt))}</time></>}</p>
   <nav className="reader-language-switch" aria-label={english?'Article language':'文章语言'}><a href={`/help-centre?article=${encodeURIComponent(article.sourceId??article.id)}`} aria-current={!english?'page':undefined}>简体中文</a>{article.englishId?<a href={`/help-centre?article=${encodeURIComponent(article.englishId)}&lang=en`} aria-current={english?'page':undefined}>English</a>:<span title={english?'An English version has not been published yet':'英文版尚未发布'}>English · Coming soon</span>}</nav>
   <NewVersionNotice documentId={article.id} revision={article.revision} locale={article.locale}/>
 </header>;
}
function BreadcrumbSeparator(){return <span className="breadcrumb-separator" aria-hidden="true">›</span>;}
