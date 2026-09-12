import type {OpsPage} from '../../ops/model';
import {SearchResultItem} from '../gitbook/Search/SearchResultItem';
export function OpsCollection({data,state}:{data?:OpsPage;state:'ready'|'denied'|'unavailable'}){
 const available=state==='ready'&&data;
 return <section className="ops-collection" aria-label="资料列表"><a className="search-back" href="/help-centre">← 返回员工资料库</a>
 {available?<><header><p className="reader-eyebrow">运营内部资料</p><h1>OPS Internal</h1><p className="reader-description">查阅已发布的运营流程、异常处理和升级处理资料。</p><p className="reader-description">此处为只读资料。内容更新须由管理员编辑、二审及发布。</p></header><p className="search-summary" role="status">共 {data.total} 篇 · 第 {data.page} / {data.pages} 页 · 本页 {data.items.length} 篇</p>
 {data.items.length?<ul className="gitbook-search-results" aria-label="已发布运营资料">{data.items.map(item=><li key={item.id}><SearchResultItem href={`/help-centre?article=${encodeURIComponent(item.id)}`} label={`阅读：${item.title}`} leadingIcon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6"/></svg>}><p className="search-result-breadcrumbs">OPS Internal · 已发布</p><h2>{item.title}</h2>{item.tags.length>0&&<p className="search-result-breadcrumbs">{item.tags.join(' · ')}</p>}</SearchResultItem></li>)}</ul>:<div className="search-state"><h2>暂时没有已发布的运营资料</h2><p>管理员发布后，有权限的资料会显示在这里。</p></div>}
 {data.pages>1&&<nav className="search-pagination" aria-label="运营资料翻页">{data.page>1&&<a className="secondary-link" href={`/help-centre/ops?page=${data.page-1}`}>上一页</a>}<span>第 {data.page} / {data.pages} 页</span>{data.page<data.pages&&<a className="secondary-link" href={`/help-centre/ops?page=${data.page+1}`}>下一页</a>}</nav>}</>
 :<div className="search-state" role="alert"><h1>{state==='denied'?'无法访问这类资料':'资料暂时无法读取'}</h1><p>{state==='denied'?'当前账号没有阅读权限，或权限已发生变化。请联系管理员核对。':'请稍后重试。如果持续失败，请联系管理员。'}</p><a className="secondary-link" href="/help-centre/ops">重新读取</a></div>}
 </section>;
}
