// Adapted from GitBook SearchPageResultItem's breadcrumb/title/highlight branch.
import type {SearchResult} from '../../../reader/search';
import {HighlightQuery} from './HighlightQuery';
import {SearchResultItem} from './SearchResultItem';
export function SearchPageResultItem({query,item}:{query:string;item:SearchResult}) {
 return <SearchResultItem href={item.href} label={`阅读：${item.title}`} leadingIcon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6"/></svg>}>
   <p className="search-result-breadcrumbs">{['帮助中心',...item.breadcrumbs].map((crumb,index)=><span key={index}>{index>0&&<span aria-hidden="true"> › </span>}{crumb}</span>)}</p>
   {item.kind&&<p className="search-result-breadcrumbs">{{article:'知识文章',ops:'OPS Internal',reference:'Reference',qa:'Q&A'}[item.kind]}{item.revision!==undefined&&<> · 正式版本 {item.revision}</>}</p>}
   <h2><HighlightQuery query={query} text={item.title}/></h2>
   {!!item.tags?.length&&<p className="search-result-breadcrumbs"><HighlightQuery query={query} text={item.tags.join(' · ')}/></p>}
   {item.snippet&&<p className="search-result-snippet"><HighlightQuery query={query} text={item.snippet}/></p>}
 </SearchResultItem>;
}
