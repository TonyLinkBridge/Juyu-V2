import Form from 'next/form';
import type {QaPage} from '../../qa/model';
import {NavigationLink as Link} from '../shell/NavigationLink';
import type {Publication} from '../../reader/body';
import {AuthenticatedQaAnswer} from './AuthenticatedQaAnswer';

function href(data:QaPage,page:number,category:string|undefined,locale:'zh-CN'|'en'){
 const p=new URLSearchParams({page:String(page)});
 if(category!==undefined)p.set('category',category);
 if(data.topic!==undefined)p.set('topic',data.topic);
 if(data.q)p.set('q',data.q);
 if(locale==='en')p.set('lang','en');
 return '/help-centre/qa?'+p;
}
export function QaView({data,state,initialAnswer,viewerId,searchEnabled=true,locale='zh-CN'}:{searchEnabled?:boolean;initialAnswer?:Publication;viewerId?:string;data?:QaPage;state:'ready'|'denied'|'unavailable'|'invalid';locale?:'zh-CN'|'en'}){
 const english=locale==='en',label=(zh:string,en:string)=>english?en:zh;
 const root=english?'/help-centre/qa?lang=en':'/help-centre/qa';
 return <section className="qa-view qa-independent" aria-label={label('Q&A 正式问答','Published Q&A')}><header><p className="reader-eyebrow">Q&A</p><h1>{label('你遇到了什么问题？','What do you need to know?')}</h1><p className="reader-description">{label('查找问题，展开查看已审核发布的标准答案。','Find a question and open its reviewed, published answer.')}</p></header>{state!=='ready'||!data?<div role="alert"><h2>{state==='denied'?label('问答阅读权限不足','You cannot access these answers'):state==='invalid'?label('问答筛选条件无效','Invalid Q&A filter'):label('问答服务暂时不可用','Q&A is unavailable')}</h2><p>{state==='denied'?label('请确认公司账号，或联系管理员核对阅读权限。','Check your company account or contact an administrator.'):state==='invalid'?label('请清除筛选后重新查看问答。','Clear the filter and try again.'):label('请稍后重新读取；如果持续失败，请联系管理员。','Try again shortly. If the problem continues, contact an administrator.')}</p><Link href={root}>{label('重新读取','Try again')}</Link></div>:<>
 {searchEnabled&&<Form action="/help-centre/qa" className="qa-search"><label className="sr-only" htmlFor="qa-search">{label('搜索问题或答案','Search questions or answers')}</label><input key={data.q??''} id="qa-search" name="q" type="search" maxLength={120} defaultValue={data.q??''} placeholder={label('例如：转入失败、修改邮箱、退款','For example: transfer failed, change email, refund')}/>{data.category!==undefined&&<input type="hidden" name="category" value={data.category}/>} {data.topic!==undefined&&<input type="hidden" name="topic" value={data.topic}/>} {english&&<input type="hidden" name="lang" value="en"/>}<button type="submit">{label('搜索问答','Search Q&A')}</button></Form>}
 <div className="qa-filter-group"><strong>{label('主要分类','Main category')}</strong><nav className="qa-categories" aria-label={label('问答分类','Q&A categories')}><Link prefetch={false} href={href({...data,topic:undefined},1,undefined,locale)} aria-current={data.category===undefined&&data.topic===undefined?'page':undefined}>{label('全部','All')}</Link>{(data.categories??[]).map(category=><Link prefetch={false} key={category} href={href(data,1,category,locale)} aria-current={data.category===category?'page':undefined}>{category||label('未分类','Uncategorized')}</Link>)}</nav></div>
 {(data.topics??[]).length>0&&<div className="qa-filter-group"><strong>{label('相关话题','Related topics')}</strong><nav className="qa-categories" aria-label={label('相关话题','Related topics')}>{(data.topics??[]).map(topic=><Link prefetch={false} key={topic} href={href({...data,topic},1,data.category,locale)} aria-current={data.topic===topic?'page':undefined}>{topic}</Link>)}</nav></div>}
 <div className="qa-list-heading"><p role="status">{data.q?label('搜索结果','Search results'):label('标准问答','Published answers')} · {english?`${data.total} questions`:`${data.total} 个问题`}</p>{data.canEdit&&<Link prefetch={false} href="/admin?kind=qa&view=list">{label('管理问答','Manage Q&A')} →</Link>}</div>
 {data.items.length?<div className="qa-question-list">{data.items.map(item=><AuthenticatedQaAnswer viewerId={viewerId} initial={initialAnswer?.id===item.id?initialAnswer:undefined} key={item.id} id={item.id} title={item.title} revision={item.revision} topics={item.tags} canEdit={data.canEdit} locale={locale}/>)}</div>:<div className="qa-empty"><h2>{label('暂时没有找到相关答案','No matching answers yet')}</h2><p>{label('试试其他关键词，或查看全部问答。','Try different keywords or browse all questions.')}</p><Link href={root}>{label('查看全部问答','View all Q&A')}</Link></div>}
 {data.pages>1&&<nav className="search-pagination" aria-label={label('问答翻页','Q&A pages')}>{data.page>1&&<Link href={href(data,data.page-1,data.category,locale)}>{label('上一页','Previous')}</Link>}<span>{data.page} / {data.pages}</span>{data.page<data.pages&&<Link href={href(data,data.page+1,data.category,locale)}>{label('下一页','Next')}</Link>}</nav>}</>}</section>;
}
