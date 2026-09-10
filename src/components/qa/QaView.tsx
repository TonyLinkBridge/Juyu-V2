import type {QaPage} from '../../qa/model';
import {SearchResultItem} from '../gitbook/Search/SearchResultItem';
function collectionHref(page:number,category?:string){const p=new URLSearchParams({page:String(page)});if(category!==undefined)p.set('category',category);return `/help-centre/qa?${p}`;}
export function QaView({data,state}:{data?:QaPage;state:'ready'|'denied'|'unavailable'}){
 return <section className="qa-view" aria-label="Q&A 正式问答"><a className="search-back" href="/help-centre">← 返回员工资料库</a><header><p className="reader-eyebrow">Q&A</p><h1>常见问答</h1><p className="reader-description">按分类查找问题，打开已发布的正式答案。</p></header>
 {state!=='ready'||!data?<div role="alert" className="search-state"><h2>{state==='denied'?'无法访问问答资料':'问答暂时无法读取'}</h2><p>请重新载入；如果持续失败，请联系管理员。</p><a className="secondary-link" href="/help-centre/qa">重新读取</a></div>:<>
 {data.canEdit&&<p className="reader-actions"><a className="secondary-link" href="/admin/editor?kind=qa">新建问答</a></p>}
 <form className="qa-filter" action="/help-centre/qa" method="get" role="search" aria-label="按问答分类查找"><label>问答分类<input name="category" defaultValue={data.category??''} maxLength={160} placeholder="填写完整分类名称"/></label><button className="secondary-link" type="submit">查看此分类</button><a className="secondary-link" href="/help-centre/qa">全部分类</a><a className="secondary-link" href={collectionHref(1,'')}>未分类</a></form>
 <p className="reference-note">分类名称需完整匹配；留空查找未分类问题。也可以使用顶部搜索查找问题或答案中的关键词。</p>
 <p className="search-summary" role="status">{data.category===undefined?'全部分类':`分类：${data.category||'未分类'}`} · 共 {data.total} 条正式问答 · 第 {data.page} / {data.pages} 页</p>
 {data.items.length?<ul className="gitbook-search-results qa-results" aria-label="正式问题">{data.items.map(item=><li key={item.id}><SearchResultItem href={`/help-centre?article=${encodeURIComponent(item.id)}`} label={`阅读答案：${item.title}`} leadingIcon={<span aria-hidden="true">?</span>}><p className="search-result-breadcrumbs">正式版本 {item.revision}</p><h2>{item.title}</h2>{item.tags.length>0&&<p className="search-result-breadcrumbs">{item.tags.join(' · ')}</p>}<span className="qa-read">阅读答案 →</span></SearchResultItem><div className="qa-item-actions"><a href={collectionHref(1,item.category)} aria-label={`查看分类：${item.category||'未分类'}`}>{item.category||'未分类'}</a>{data.canEdit&&<a href={`/admin/editor?article=${encodeURIComponent(item.id)}`} aria-label={`编辑问答：${item.title}`}>编辑问答</a>}</div></li>)}</ul>:<div className="search-state"><h2>{data.category===undefined?'暂时没有已发布的问答':'此分类下没有可阅读的正式问答'}</h2><p>可以查看全部分类或使用顶部搜索。</p></div>}
 {data.pages>1&&<nav className="search-pagination" aria-label="问答翻页">{data.page>1&&<a className="secondary-link" href={collectionHref(data.page-1,data.category)}>上一页</a>}<span>{data.page} / {data.pages}</span>{data.page<data.pages&&<a className="secondary-link" href={collectionHref(data.page+1,data.category)}>下一页</a>}</nav>}
 </>}
 </section>;
}
