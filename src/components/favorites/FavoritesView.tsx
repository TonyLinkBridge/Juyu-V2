import type {FavoritesPage} from '../../favorites/model';
import {kinds} from '../../workspace/model';
import {SearchResultItem} from '../gitbook/Search/SearchResultItem';
import {FavoriteButton} from './FavoriteButton';
export function FavoritesView({data,state}:{data?:FavoritesPage;state:'ready'|'denied'|'unavailable'}){
 return <section className="favorites-view" aria-label="我的收藏"><a className="search-back" href="/help-centre">← 返回员工资料库</a><header><p className="reader-eyebrow">PERSONAL</p><h1>我的收藏</h1><p className="reader-description">保存常用资料，方便下次查阅。这里显示你目前有权阅读的最新正式版本。</p></header>
 {state!=='ready'||!data?<div role="alert" className="search-state"><h2>{state==='denied'?'收藏访问已暂停':'收藏暂时无法读取'}</h2><p>请重新读取；如果持续失败，请联系管理员。</p><a className="secondary-link" href="/help-centre/favorites">重新读取收藏列表</a></div>:<><a className="secondary-link" href={`/help-centre/favorites?page=${data.page}`}>刷新收藏</a><p className="search-summary" role="status">共 {data.total} 篇可阅读的收藏 · 第 {data.page} / {data.pages} 页</p>
 {data.items.length?<ul className="gitbook-search-results favorites-results" aria-label="已收藏的正式资料">{data.items.map(item=><li key={item.id}><SearchResultItem href={`/help-centre?article=${encodeURIComponent(item.id)}`} label={`阅读收藏：${item.title}`} leadingIcon={<span aria-hidden="true">☆</span>}><p className="search-result-breadcrumbs">{kinds[item.kind]} · 正式版本 {item.revision}</p><h2>{item.title}</h2>{item.tags.length>0&&<p className="search-result-breadcrumbs">{item.tags.join(' · ')}</p>}</SearchResultItem><div className="favorite-item-actions"><FavoriteButton documentId={item.id} revision={item.revision} initial={{documentId:item.id,revision:item.revision,saved:true}} reloadOnChange label={`收藏操作：${item.title}`}/></div></li>)}</ul>:<div className="search-state"><h2>暂无可阅读的收藏</h2><p>打开一篇正式文章，点击“收藏文章”，即可在这里找到。有些已收藏资料可能已下线或不再有访问权限。</p><a className="secondary-link" href="/help-centre">前往资料库</a></div>}
 {data.pages>1&&<nav className="search-pagination" aria-label="收藏翻页">{data.page>1&&<a className="secondary-link" href={`/help-centre/favorites?page=${data.page-1}`}>上一页</a>}<span>{data.page} / {data.pages}</span>{data.page<data.pages&&<a className="secondary-link" href={`/help-centre/favorites?page=${data.page+1}`}>下一页</a>}</nav>}
 </>}
 </section>;
}
