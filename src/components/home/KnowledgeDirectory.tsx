import type {ReactNode} from 'react';
import {ArrowLeft,ArrowRight} from '@phosphor-icons/react/dist/ssr';
import {NavigationLink as Link} from '../shell/NavigationLink';
import {KnowledgeHomeHero} from './KnowledgeHomeHero';
import {DirectoryCategoryCards} from './DirectoryCategoryCards';
import {categoryCards,categoryHref,type CategoryPage} from '../../reader/category-page';
import type {NavigationNode} from '../../reader/tree';
import type {MenuItem} from '../../navigation-settings/model';
import type {NavigationPage} from '../../reader/navigation';

export interface KnowledgeDirectoryProps {
 pages:NavigationNode[];
 menu:MenuItem[];
 search?:boolean;
 locale?:'zh-CN'|'en';
 category?:CategoryPage;
 home?:boolean;
 children?:ReactNode;
}
export function KnowledgeDirectory({pages,menu,search=true,locale='zh-CN',category,home=false,children}:KnowledgeDirectoryProps){
 const english=locale==='en',library='/help-centre/library'+(english?'?lang=en':'');
 const cards=categoryCards(category?.groups??pages,locale);
 const articles:NavigationPage[]=category?.items??pages.filter((node):node is Extract<NavigationNode,{type:'document'}>=>node.type==='document');
 return <div className="knowledge-home knowledge-home--editorial knowledge-directory" data-knowledge-directory="" data-category-id={category?.id}>
  <KnowledgeHomeHero menu={menu} search={search} locale={locale} directory title={category?.title}/>
  <div className="home-content">
   {category&&<nav className="directory-breadcrumbs" aria-label={english?'Breadcrumb':'当前位置'}>
    <Link prefetch={false} prefetchOnIntent href={library}>{english?'Articles':'知识文章'}</Link>
    {category.ancestors.map(ancestor=><span key={ancestor.id}><span aria-hidden="true">/</span><Link prefetch={false} prefetchOnIntent href={categoryHref(ancestor.id,locale)}>{ancestor.title}</Link></span>)}
    <span aria-current="page">{category.title}</span>
   </nav>}
   {cards.length>0&&<section aria-labelledby="directory-categories-title">
    <div className="home-section-heading"><h2 id="directory-categories-title">{category?(english?'Subcategories':'子分类'):(english?'Articles':'知识文章')}</h2><span>{english?'Browse approved guidance by topic':'按业务分类查阅正式资料'}</span></div>
    <DirectoryCategoryCards cards={cards} locale={locale}/>
   </section>}
   {articles.length>0&&<section className="directory-articles" aria-labelledby="directory-articles-title">
    <div className="home-section-heading"><h2 id="directory-articles-title">{category?(english?'Articles in this topic':'分类文章'):(cards.length?(english?'Other articles':'其他文章'):(english?'Articles':'知识文章'))}</h2>{category&&<span>{english?`${category.total} articles · Page ${category.page} of ${category.pages}`:`共 ${category.total} 篇 · 第 ${category.page} / ${category.pages} 页`}</span>}</div>
    <ul className="directory-article-list">{articles.map(article=><li key={article.id}><Link prefetch={false} prefetchOnIntent href={article.href}>
     <div><h3>{article.title}</h3>{article.description&&<p>{article.description}</p>}</div><ArrowRight size={20} aria-hidden="true"/>
    </Link></li>)}</ul>
    {category&&category.pages>1&&<nav className="directory-pagination" aria-label={english?'Article pages':'文章分页'}>
     {category.page>1&&<Link prefetch={false} prefetchOnIntent href={categoryHref(category.id,locale,category.page-1)}><ArrowLeft size={16} aria-hidden="true"/>{english?'Previous':'上一页'}</Link>}
     <span>{category.page} / {category.pages}</span>
     {category.page<category.pages&&<Link prefetch={false} prefetchOnIntent href={categoryHref(category.id,locale,category.page+1)}>{english?'Next':'下一页'}<ArrowRight size={16} aria-hidden="true"/></Link>}
    </nav>}
   </section>}
   {!cards.length&&!articles.length&&<section className="home-empty"><h2>{english?'No articles available yet':'暂无可阅读的正式资料'}</h2><p>{english?'Published articles you can read will appear here.':'有你可以阅读的文章发布后，会显示在这里。'}</p></section>}
   {children}
   <footer className="directory-footer"><p>{english?'Only content you have permission to read is shown.':'资料按你的阅读权限展示'}</p>{!home&&<Link prefetch={false} prefetchOnIntent href={'/help-centre'+(english?'?lang=en':'')}><ArrowLeft size={16} aria-hidden="true"/>{english?'Back to the Help Centre':'返回知识库首页'}</Link>}</footer>
  </div>
 </div>;
}
