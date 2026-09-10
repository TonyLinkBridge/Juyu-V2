// Adapted from GitBook SearchResults page-result and empty/error branches.
// A full results page uses native list/link semantics instead of a popup listbox.
import type {ReactNode} from 'react';
import {searchHref,type TitleSearch} from '../../../reader/search';
import {SearchPageResultItem} from './SearchPageResultItem';
export function SearchResults({search,failed=false,retryHref,children}:{search:TitleSearch;failed?:boolean;retryHref:string;children?:ReactNode}) {
 return <main id="main-content" className="reader-main search-main">
   <p className="reader-eyebrow">员工资料库</p><h1>搜索结果</h1>
   <p className="reader-description">搜索你有权阅读的已发布资料：标题、标签和正文。</p>
   {failed?<div role="alert" className="search-state"><h2>搜索暂时无法加载</h2><p>请重试。如果持续失败，请联系管理员。</p><a className="secondary-link" href={retryHref}>重新搜索</a></div>
   :search.status==='invalid'?<div role="alert" className="search-state"><h2>搜索条件不正确</h2><p>请在顶部重新输入，最多 120 个字符。</p></div>
   :search.status==='empty'?<div className="search-state"><h2>输入关键词，开始查找</h2><p>可以输入标题或正文中的词语，例如“域名转出”。多个关键词用空格分开。</p></div>
   :<>
     <p className="search-summary" role="status">“{search.query}” · 找到 {search.total} 篇文章</p>
     {search.results.length?<ul className="gitbook-search-results" aria-label="搜索结果列表">{search.results.map(item=><li key={item.id}><SearchPageResultItem query={search.query} item={item}/></li>)}</ul>
       :<div className="search-state"><h2>{search.total?'这一页没有结果':'没有找到相关文章'}</h2><p>{search.total?'返回第一页继续查找。':'试试更短的关键词，或从左侧目录查找。搜索范围包括知识文章、OPS、Reference 和 Q&A 中有权阅读的正式资料。'}</p>{search.total>0&&<a className="secondary-link" href={searchHref(search.query)}>返回第一页</a>}</div>}
     {search.results.length>0&&search.pages>1&&<nav className="search-pagination" aria-label="搜索结果翻页">
       {search.page>1&&<a className="secondary-link" href={searchHref(search.query,search.page-1)}>上一页</a>}
       <span>第 {search.page} / {search.pages} 页</span>
       {search.page<search.pages&&<a className="secondary-link" href={searchHref(search.query,search.page+1)}>下一页</a>}
     </nav>}
   </>}
   <a className="search-back" href="/help-centre">返回资料目录</a>
   {children}
 </main>;
}
