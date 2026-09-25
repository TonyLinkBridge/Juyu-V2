// Adapted from GitBook SearchResults page-result and empty/error branches.
// A full results page uses native list/link semantics instead of a popup listbox.
import type {ReactNode} from 'react';
import {searchHref,searchScopeLabels,englishSearchScopeLabels,type SearchScope,type TitleSearch} from '../../../reader/search';
import {SearchPageResultItem} from './SearchPageResultItem';

export interface SearchResultsProps {search:TitleSearch;scope?:SearchScope;failed?:boolean;retryHref:string;locale?:'zh-CN'|'en';children?:ReactNode}

export function SearchResultsBody({search,scope='all',failed=false,retryHref,locale='zh-CN',children}:SearchResultsProps) {
 const english=locale==='en';
 return <>
   {failed?<div role="alert" className="search-state"><h2>{english?'Search is unavailable right now':'搜索暂时无法加载'}</h2><p>{english?'Please try again. If it keeps happening, contact an admin.':'请重试。如果持续失败，请联系管理员。'}</p><a className="secondary-link" href={retryHref}>{english?'Try again':'重新搜索'}</a></div>
   :search.status==='invalid'?<div role="alert" className="search-state"><h2>{english?'Check your search':'搜索条件不正确'}</h2><p>{english?'Enter up to 120 characters in the search box above.':'请在顶部重新输入，最多 120 个字符。'}</p></div>
   :search.status==='empty'?<div className="search-state"><h2>{english?'What are you looking for?':'输入关键词，开始查找'}</h2><p>{english?'Search by title or a phrase from an article. Separate multiple terms with spaces.':'可以输入标题或正文中的词语，例如“域名转出”。多个关键词用空格分开。'}</p></div>
   :<>
     <p className="search-summary" role="status">“{search.query}” · {scope==='all'?'':`${english?englishSearchScopeLabels[scope]:searchScopeLabels[scope]} · `}{english?`${search.total} results`:`找到 ${search.total} 项结果`}</p>
     {search.results.length?<ul className="gitbook-search-results" aria-label={english?'Search results':'搜索结果列表'}>{search.results.map(item=><li key={item.id}><SearchPageResultItem query={search.query} item={item} locale={locale}/></li>)}</ul>
       :<div className="search-state"><h2>{english?(search.total?'No results on this page':'No matches found'):(search.total?'这一页没有结果':'没有找到相关结果')}</h2><p>{english?(search.total?'Go back to the first page to keep browsing.':'Try a shorter search, or browse the article directory.'):(search.total?'返回第一页继续查找。':'试试更短的关键词，或从左侧目录查找。搜索范围包括知识文章、OPS、Reference 和 Q&A 中有权阅读的正式资料。')}</p>{search.total>0&&<a className="secondary-link" href={searchHref(search.query,1,scope,locale)}>{english?'First page':'返回第一页'}</a>}</div>}
     {search.results.length>0&&search.pages>1&&<nav className="search-pagination" aria-label={english?'Search pages':'搜索结果翻页'}>
       {search.page>1&&<a className="secondary-link" href={searchHref(search.query,search.page-1,scope,locale)}>{english?'Previous':'上一页'}</a>}
       <span>{english?`Page ${search.page} of ${search.pages}`:`第 ${search.page} / ${search.pages} 页`}</span>
       {search.page<search.pages&&<a className="secondary-link" href={searchHref(search.query,search.page+1,scope,locale)}>{english?'Next':'下一页'}</a>}
     </nav>}
   </>}
   <a className="search-back" href={english?'/help-centre?lang=en':'/help-centre'}>{english?'Browse articles':'返回资料目录'}</a>
   {children}
 </>;
}

export function SearchResults(props:SearchResultsProps) {
 const english=props.locale==='en';
 return <main id="main-content" className="reader-main search-main">
  <p className="reader-eyebrow">{english?'Team knowledge':'员工资料库'}</p><h1>{english?'Search results':'搜索结果'}</h1>
  <p className="reader-description">{english?'Search published articles you can access by title, tag, or content.':'搜索你有权阅读的已发布资料：标题、标签和正文。'}</p>
  <SearchResultsBody {...props}/>
 </main>;
}
