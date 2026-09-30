'use client';
import {useEffect,useState} from 'react';
import type {PeoplePage} from '../../analytics/dashboard';
import {visibleDuration} from '../../analytics/dashboard-format';
export function AnalyticsPeople({days,documentId}:{days:7|30|90;documentId?:string}){
 const [page,setPage]=useState(1),[data,setData]=useState<PeoplePage|null>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();let active=true;
  const params=new URLSearchParams({days:String(days),page:String(page)});if(documentId)params.set('documentId',documentId);
  void fetch(`/api/admin/analytics/people?${params}`,{credentials:'same-origin',cache:'no-store',signal:controller.signal}).then(async response=>{
   if(!response.ok)throw new Error('UNAVAILABLE');const next=await response.json() as PeoplePage;if(active){setData(next);setError(false);}
  }).catch(()=>{if(active)setError(true);});
  return()=>{active=false;controller.abort();};
 },[days,documentId,page,retry]);
 if(error)return <div className="admin-data-empty" role="alert"><p>员工明细暂时无法读取。</p><button onClick={()=>{setError(false);setData(null);setRetry(x=>x+1);}}>重新读取</button></div>;
 if(!data)return <p className="admin-data-empty" role="status">正在读取员工明细…</p>;
 return <><p className="admin-data-caption">{data.total} 位员工 · 按打开次数排序</p>{data.items.length?<div className="admin-data-table-scroll analytics-people-scroll" role="region" aria-label="员工使用表格，可滚动" tabIndex={0}><table className="admin-data-table"><thead><tr><th>员工</th><th>打开次数</th>{!documentId&&<th>打开资料数</th>}<th>平均可见停留</th></tr></thead><tbody>{data.items.map(person=><tr key={person.memberId}><th scope="row">{person.displayName}</th><td>{person.views}</td>{!documentId&&<td>{person.documents}</td>}<td>{visibleDuration(person.averageVisibleMs)}<small>{person.measuredViews} 次有时长记录</small></td></tr>)}</tbody></table></div>:<p className="admin-data-empty">这段时间还没有员工打开记录。</p>}
 <div className="admin-data-pagination"><button disabled={data.page<=1} onClick={()=>{setData(null);setPage(data.page-1);}}>上一页</button><span>第 {data.page} / {data.pages} 页</span><button disabled={data.page>=data.pages} onClick={()=>{setData(null);setPage(data.page+1);}}>下一页</button></div>
 <p className="admin-data-caption">可见停留只统计页面在前台显示的时间，不代表读完。平均值仅计算有时长记录的打开。</p></>;
}
