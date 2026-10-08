import type {ContentKind} from '../domain/model.ts';
export type DashboardDays=7|30|90;
export interface CalendarRange {from:string;to:string}
export type DashboardRange=DashboardDays|CalendarRange;
const DAY=86400000;
export function analyticsToday(now=new Date()){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);return ['year','month','day'].map(type=>parts.find(part=>part.type===type)!.value).join('-');}
function dateStamp(value:unknown){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'2000-01-01')throw new Error('INVALID_INPUT');
 const stamp=Date.parse(value+'T00:00:00.000Z');if(!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==value)throw new Error('INVALID_INPUT');return stamp;
}
export function analyticsRange(input:unknown=undefined,now=new Date()):{days:number;from?:string;to?:string;start:string|null;end:string|null}{
 if(typeof input!=='object'||input===null)return {days:rangeDays(input),start:null,end:null};
 if(Array.isArray(input)||Object.keys(input).some(key=>!['from','to'].includes(key)))throw new Error('INVALID_INPUT');
 const {from,to}=input as CalendarRange,start=dateStamp(from),end=dateStamp(to),days=(end-start)/DAY+1;
 if(days<1||days>90||to>analyticsToday(now))throw new Error('INVALID_INPUT');
 return {days,from,to,start:new Date(start-8*3600000).toISOString(),end:new Date(end+DAY-8*3600000).toISOString()};
}
export function analyticsRangeParams(range:DashboardRange){const params=new URLSearchParams();if(typeof range==='number')params.set('days',String(range));else{params.set('from',range.from);params.set('to',range.to);}return params;}

export interface SearchGroup {fingerprint:string;searches:number;zeroResults:number;clickedSearches:number}
export interface PopularArticle {documentId:string;title:string;kind:ContentKind;revision:number;views:number}
export interface NegativeFeedback {documentId:string;title:string;kind:ContentKind;revision:number;total:number;negative:number}
export interface DashboardData {
 days:number;dateRange?:CalendarRange|null;from:string;asOf:string;usage?:UsageData;
 summary:{searches:number;zeroResults:number;clickedSearches:number;searchClicks:number;views:number;feedbackTotal:number;feedbackNegative:number};
 popularSearches:SearchGroup[];zeroResultSearches:SearchGroup[];popularArticles:PopularArticle[];negativeFeedback:NegativeFeedback[];
}
export function rangeDays(value:unknown=undefined):DashboardDays {
 if(value===undefined)return 30;
 if(value===7||value==='7')return 7;
 if(value===30||value==='30')return 30;
 if(value===90||value==='90')return 90;
 throw new Error('INVALID_INPUT');
}

export interface ArticleUsage {documentId:string;readers:number;measuredViews:number;averageVisibleMs:number|null}
export interface UsageData {readers:number;measuredViews:number;averageVisibleMs:number|null;trend:{date:string;views:number}[];articles:ArticleUsage[]}
export interface PersonUsage {memberId:string;displayName:string;views:number;documents:number;measuredViews:number;averageVisibleMs:number|null;lastOpened:string}
export interface PeoplePage {items:PersonUsage[];total:number;page:number;pages:number}
export function peopleQuery(input:Record<string,unknown>){
 if(Object.keys(input).some(k=>!['days','from','to','page','documentId'].includes(k))||input.page!==undefined&&typeof input.page!=='string'&&typeof input.page!=='number')throw new Error('INVALID_INPUT');
 const custom=input.from!==undefined||input.to!==undefined;if(custom&&input.days!==undefined)throw new Error('INVALID_INPUT');
 const range=analyticsRange(custom?{from:input.from,to:input.to}:input.days),days=range.days,page=input.page===undefined?1:Number(input.page);
 if(!Number.isSafeInteger(page)||page<1||page>999999||input.page!==undefined&&!/^[1-9]\d*$/.test(String(input.page)))throw new Error('INVALID_INPUT');
 const documentId=input.documentId;
 if(documentId!==undefined&&(typeof documentId!=='string'||!documentId.trim()||documentId!==documentId.trim()||documentId.length>200||/[\x00-\x1f\x7f]/.test(documentId)))throw new Error('INVALID_INPUT');
 return {days,...(range.from?{from:range.from,to:range.to}:{}),page,documentId:documentId as string|undefined};
}
