import type {RecentPage} from '../../recent/model';
import {kinds} from '../../workspace/model';
import {SearchResultItem} from '../gitbook/Search/SearchResultItem';
function viewedTime(value:string){return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));}
export function RecentView({data,state}:{data?:RecentPage;state:'ready'|'denied'|'unavailable'}){
 return <section className="favorites-view recent-view" aria-label="最近浏览"><a className="search-back" href="/help-centre">← 返回员工资料库</a><header><p className="reader-eyebrow">PERSONAL</p><h1>最近浏览</h1><p className="reader-description">找回最近打开的资料。每人最多保留 100 篇，只显示你目前有权阅读的正式内容。</p></header>
 {state!=='ready'||!data?<div role="alert" className="search-state"><h2>{state==='denied'?'最近浏览访问已暂停':'最近浏览暂时无法读取'}</h2><p>请重新读取；如果持续失败，请联系管理员。</p><a className="secondary-link" href="/help-centre/recent">重新读取最近浏览</a></div>:<><a className="secondary-link" href={`/help-centre/recent?page=${data.page}`}>刷新最近浏览</a><p className="search-summary" role="status">共 {data.total} 篇可阅读的资料 · 第 {data.page} / {data.pages} 页</p>
 {data.items.length?<ul className="gitbook-search-results" aria-label="最近打开的正式资料">{data.items.map(item=><li key={item.id}><SearchResultItem href={`/help-centre?article=${encodeURIComponent(item.id)}`} label={`再次阅读：${item.title}`} leadingIcon={<span aria-hidden="true">↺</span>}><p className="search-result-breadcrumbs">{kinds[item.kind]} · 正式版本 {item.revision}{item.viewedRevision!==item.revision?' · 上次阅读后有更新':''}</p><h2>{item.title}</h2>{item.tags.length>0&&<p className="search-result-breadcrumbs">{item.tags.join(' · ')}</p>}<p className="search-result-breadcrumbs">上次打开 <time dateTime={item.viewedAt}>{viewedTime(item.viewedAt)}</time>（UTC+8）</p></SearchResultItem></li>)}</ul>:<div className="search-state"><h2>暂无可阅读的浏览记录</h2><p>打开正式文章后会自动记录。已下线或不再有权阅读的资料不会显示。</p><a className="secondary-link" href="/help-centre">前往资料库</a></div>}
 {data.pages>1&&<nav className="search-pagination" aria-label="最近浏览翻页">{data.page>1&&<a className="secondary-link" href={`/help-centre/recent?page=${data.page-1}`}>上一页</a>}<span>{data.page} / {data.pages}</span>{data.page<data.pages&&<a className="secondary-link" href={`/help-centre/recent?page=${data.page+1}`}>下一页</a>}</nav>}
 </>}
 </section>;
}
