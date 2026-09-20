// Adapted from GitBook SearchPageResultItem's breadcrumb/title/highlight branch.
import type {SearchResult} from '../../../reader/search';
import {HighlightQuery} from './HighlightQuery';
import {SearchResultItem} from './SearchResultItem';
export function SearchPageResultItem({query,item,locale='zh-CN'}:{query:string;item:SearchResult;locale?:'zh-CN'|'en'}) {
 const qa=item.kind==='qa';
 const english=locale==='en';const kindLabel=english?{article:'Article',ops:'OPS Internal',reference:'Reference',qa:'Q&A'}[item.kind??'article']:{article:'知识文章',ops:'OPS Internal',reference:'Reference 速查',qa:'Q&A 问答'}[item.kind??'article'];
 return <SearchResultItem href={item.href} label={`${english?qa?'View answer':'Read':qa?'查看答案':'阅读'}：${item.title}`} leadingIcon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">{qa?<path d="M4 4h16v13H9l-5 4V4zM9 8a3 3 0 0 1 6 0c0 2-3 2-3 4m0 2v1"/>:<path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6"/>}</svg>}>
   <p className="search-result-breadcrumbs">{[kindLabel,...item.breadcrumbs].map((crumb,index)=><span key={index}>{index>0&&<span aria-hidden="true"> › </span>}{crumb}</span>)}</p>
   {item.revision!==undefined&&<p className="search-result-breadcrumbs">{english?'Published':'已发布'}</p>}
   <h2><HighlightQuery query={query} text={item.title}/></h2>
   {!!item.tags?.length&&<p className="search-result-breadcrumbs"><HighlightQuery query={query} text={item.tags.join(' · ')}/></p>}
   {item.snippet&&<p className="search-result-snippet"><HighlightQuery query={query} text={item.snippet}/></p>}
 </SearchResultItem>;
}
