'use client';
import {useRouter} from 'next/navigation';
import {useState} from 'react';
import {analyticsRange,analyticsRangeParams,analyticsToday,type DashboardRange} from '../../analytics/dashboard';
import {DateRangePicker,type DateRange} from '../ui/arc/date-range-picker/date-range-picker';
import {ArcScope} from '../ui/arc/ArcScope';
function localDate(key:string){const [year,month,day]=key.split('-').map(Number);return new Date(year,month-1,day);}
function key(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function AnalyticsDateFilter({range}:{range:DashboardRange}){
 const router=useRouter();
 const today=localDate(analyticsToday()),[error,setError]=useState('');
 const current=typeof range==='number'?null:{start:localDate(range.from),end:localDate(range.to)};
 function apply(dates:DateRange){const selected={from:key(dates.start),to:key(dates.end)};try{analyticsRange(selected);setError('');router.push(`/admin/analytics?${analyticsRangeParams(selected)}`);}catch{setError('请选择有效日期：开始不晚于结束，最多 90 天，且不能选择未来日期。');}}
 return <div className="analytics-date-filter" aria-label="统计时间筛选"><ArcScope><DateRangePicker label="统计范围" placeholder={typeof range==='number'?`最近 ${range} 天（滚动）`:'选择日期'} locale="zh-CN" weekStartsOn={1} value={current} minDate={new Date(2000,0,1)} maxDate={today} onChange={apply} presets={[7,30,90].map(days=>({label:`最近 ${days} 天`,range:()=>({start:new Date(today.getFullYear(),today.getMonth(),today.getDate()-days+1),end:today})}))}/></ArcScope><small className="admin-data-caption">自选日期按 UTC+8 自然日统计，最多 90 天</small>{error&&<p role="alert">{error}</p>}</div>;
}
