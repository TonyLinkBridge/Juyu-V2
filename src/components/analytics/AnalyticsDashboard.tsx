import type {DashboardData,SearchGroup} from '../../analytics/dashboard';
import {analyticsPercent} from '../../analytics/dashboard-format';
import {kinds} from '../../workspace/model';
type State='ready'|'unavailable'|'denied'|'invalid';
function dateLabel(value:string){return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));}
export function AnalyticsDashboard({data,state='ready',days=30}:{data?:DashboardData;state?:State;days?:7|30|90}){
 const ready=state==='ready'&&data!==undefined;const selected=ready?data.days:days;
 return <main id="main-content" className="analytics-main"><a className="back-link" href="/admin">← 内容管理</a><div className="analytics-heading"><div><p className="card-kicker">USAGE ANALYTICS</p><h1>使用分析</h1><p>了解员工如何查找资料，优先改进找不到或不够有用的内容。</p></div><a className="secondary-link" href={`/admin/analytics?days=${selected}`}>刷新统计</a></div>
 <form action="/admin/analytics" method="get" className="analytics-filter" aria-label="统计时间筛选"><label htmlFor="analytics-days">统计范围</label><select id="analytics-days" name="days" defaultValue={selected}>{[7,30,90].map(value=><option key={value} value={value}>最近 {value} 天</option>)}</select><button className="secondary-link" type="submit">查看统计</button></form>
 {!ready?<section className="analytics-notice" role="alert"><h2>{state==='invalid'?'统计范围不正确':state==='denied'?'没有查看使用分析的权限':'使用分析暂时无法读取'}</h2><p>{state==='invalid'?'请选择最近 7、30 或 90 天。':'请重新读取；如果持续失败，请检查服务连接或联系管理员。'}</p><a className="secondary-link" href="/admin/analytics">重新读取统计</a></section>:<>
 <p className="analytics-window">统计时间：<time dateTime={data.from}>{dateLabel(data.from)}</time> ～ <time dateTime={data.asOf}>{dateLabel(data.asOf)}</time>（UTC+8）</p>
 <section className="analytics-notice" aria-label="统计口径"><p>仅展示已成功采集的数据，可能存在漏报。搜索按结果页展示计数，翻页也算一次；打开文章不等于已读完。</p><p>搜索词原文未保存，因此下方按标识分组，无法显示具体热门关键词。同一搜索内容会归入同组。</p></section>
 <dl className="analytics-metrics" aria-label="使用概览">
  <Metric label="搜索结果页展示" value={String(data.summary.searches)} detail="包含零结果和分页展示"/>
  <Metric label="零结果展示" value={String(data.summary.zeroResults)} detail={`占搜索展示 ${analyticsPercent(data.summary.zeroResults,data.summary.searches)}`}/>
  <Metric label="搜索点击率" value={analyticsPercent(data.summary.clickedSearches,data.summary.searches)} detail={`${data.summary.clickedSearches} 次展示有过点击；共 ${data.summary.searchClicks} 次结果点击`}/>
  <Metric label="可读资料打开次数" value={String(data.summary.views)} detail="仅当前可读正式资料，合计其各版本的打开记录"/>
 </dl>
 {data.summary.searches===0&&data.summary.views===0&&data.summary.feedbackTotal===0&&<p className="analytics-empty" role="status">所选时间内暂无可展示的数据。接入真实服务并产生使用记录后，这里才会出现统计。</p>}
 <div className="analytics-grid">
  <SearchGroups title="热门搜索分组" rows={data.popularSearches} description="按结果页展示次数排序，最多显示前 10 组。" empty="所选时间内没有搜索展示记录。"/>
  <SearchGroups title="零结果搜索分组" rows={data.zeroResultSearches} description="按零结果展示次数排序，最多显示前 10 组。" empty="所选时间内没有零结果搜索记录。"/>
  <section className="analytics-section" aria-label="热门资料"><h2>热门资料</h2><p>当前可读的正式资料，按打开次数排序，最多前 10 篇。显示最新正式标题，次数包含其旧版本访问。</p>{data.popularArticles.length?<ol className="analytics-ranking">{data.popularArticles.map(item=><li key={item.documentId}><div><a href={`/help-centre?article=${encodeURIComponent(item.documentId)}`}>{item.title}</a><p>{kinds[item.kind]} · 当前正式版本 {item.revision}</p></div><span><strong>{item.views}</strong> 次打开</span></li>)}</ol>:<p className="analytics-empty">所选时间内没有当前可读资料的打开记录。</p>}</section>
  <section className="analytics-section" aria-label="需要改进的资料"><h2>需要改进的资料</h2><p>当前正式版本的有效评价，按“没有帮助”数量排序，最多前 10 篇。仅统计最后修改时间在所选范围内的评价，每员工每版本一份。</p><p className="analytics-feedback-summary">共 {data.summary.feedbackTotal} 份评价 · {data.summary.feedbackNegative} 份没有帮助 · 占比 {analyticsPercent(data.summary.feedbackNegative,data.summary.feedbackTotal)}</p>{data.negativeFeedback.length?<ol className="analytics-ranking">{data.negativeFeedback.map(item=><li key={item.documentId}><div><a href={`/admin/feedback?document=${encodeURIComponent(item.documentId)}&revision=${item.revision}`}>{item.title}</a><p>{kinds[item.kind]} · 当前正式版本 {item.revision}</p></div><span><strong>{item.negative} / {item.total}</strong> 份没有帮助</span></li>)}</ol>:<p className="analytics-empty">所选时间内没有当前正式版本的负面评价。</p>}<a className="back-link" href="/admin/feedback">查看文章反馈 →</a></section>
 </div>
 </>}
 </main>;
}
function Metric({label,value,detail}:{label:string;value:string;detail:string}){return <div className="analytics-metric"><dt>{label}</dt><dd>{value}</dd><dd className="analytics-metric-detail">{detail}</dd></div>;}
function SearchGroups({title,description,rows,empty}:{title:string;description:string;rows:SearchGroup[];empty:string}){return <section className="analytics-section" aria-label={title}><h2>{title}</h2><p>{description}</p>{rows.length?<div className="analytics-table-scroll" role="region" aria-label={`${title}表格，可横向滚动`} tabIndex={0}><table><caption className="sr-only">{title}</caption><thead><tr><th scope="col">搜索标识</th><th scope="col">展示</th><th scope="col">零结果</th><th scope="col">有点击的展示</th><th scope="col">点击率</th></tr></thead><tbody>{rows.map(row=><tr key={row.fingerprint}><th scope="row"><abbr className="analytics-fingerprint" title={row.fingerprint}>{row.fingerprint.replace(/^sha256:/,'').slice(0,12)}</abbr></th><td>{row.searches}</td><td>{row.zeroResults}</td><td>{row.clickedSearches}</td><td>{analyticsPercent(row.clickedSearches,row.searches)}</td></tr>)}</tbody></table></div>:<p className="analytics-empty">{empty}</p>}</section>;}
