import Form from 'next/form';
import type {QaPage} from '../../qa/model';
import {NavigationLink as Link} from '../shell/NavigationLink';
import type {Publication} from '../../reader/body';
import {AuthenticatedQaAnswer} from './AuthenticatedQaAnswer';
function href(data:QaPage,page:number,category=data.category){const p=new URLSearchParams({page:String(page)});if(category!==undefined)p.set('category',category);if(data.q)p.set('q',data.q);return '/help-centre/qa?'+p;}
export function QaView({data,state,initialAnswer,viewerId,searchEnabled=true}:{searchEnabled?:boolean;initialAnswer?:Publication;viewerId?:string;data?:QaPage;state:'ready'|'denied'|'unavailable'|'invalid'}){
 return <section className="qa-view qa-independent" aria-label="Q&A 正式问答"><header><p className="reader-eyebrow">Q&A</p><h1>你遇到了什么问题？</h1><p className="reader-description">查找问题，展开查看已审核发布的标准答案。</p></header>{state!=='ready'||!data?<div role="alert"><h2>{state==='denied'?'问答阅读权限不足':state==='invalid'?'问答筛选条件无效':'问答服务暂时不可用'}</h2><p>{state==='denied'?'请确认公司账号，或联系管理员核对阅读权限。':state==='invalid'?'请清除筛选后重新查看问答。':'请稍后重新读取；如果持续失败，请联系管理员。'}</p><Link href="/help-centre/qa">重新读取</Link></div>:<>
 {searchEnabled&&<Form action="/help-centre/qa" className="qa-search"><label className="sr-only" htmlFor="qa-search">搜索问题或答案</label><input key={data.q??''} id="qa-search" name="q" type="search" maxLength={120} defaultValue={data.q??''} placeholder="例如：转入失败、修改邮箱、退款"/>{data.category!==undefined&&<input type="hidden" name="category" value={data.category}/>}<button type="submit">搜索问答</button></Form>}
 <nav className="qa-categories" aria-label="问答分类"><Link prefetch={false} href={href({...data,category:undefined},1)} aria-current={data.category===undefined?'page':undefined}>全部</Link>{(data.categories??[]).map(category=><Link prefetch={false} key={category} href={href(data,1,category)} aria-current={data.category===category?'page':undefined}>{category||'未分类'}</Link>)}</nav>
 <div className="qa-list-heading"><p role="status">{data.q?'搜索结果':'标准问答'} · {data.total} 个问题</p>{data.canEdit&&<Link prefetch={false} href="/admin?kind=qa&view=list">管理问答 →</Link>}</div>
 {data.items.length?<div className="qa-question-list">{data.items.map(item=><AuthenticatedQaAnswer viewerId={viewerId} initial={initialAnswer?.id===item.id?initialAnswer:undefined} key={item.id} id={item.id} title={item.title} revision={item.revision} canEdit={data.canEdit}/>)}</div>:<div className="qa-empty"><h2>暂时没有找到相关答案</h2><p>试试其他关键词，或查看全部问答。</p><Link href="/help-centre/qa">查看全部问答</Link></div>}
 {data.pages>1&&<nav className="search-pagination" aria-label="问答翻页">{data.page>1&&<Link href={href(data,data.page-1)}>上一页</Link>}<span>{data.page} / {data.pages}</span>{data.page<data.pages&&<Link href={href(data,data.page+1)}>下一页</Link>}</nav>}</> }</section>;
}
