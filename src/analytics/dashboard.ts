import type {ContentKind} from '../domain/model.ts';
export type DashboardDays=7|30|90;
export interface SearchGroup {fingerprint:string;searches:number;zeroResults:number;clickedSearches:number}
export interface PopularArticle {documentId:string;title:string;kind:ContentKind;revision:number;views:number}
export interface NegativeFeedback {documentId:string;title:string;kind:ContentKind;revision:number;total:number;negative:number}
export interface DashboardData {
 days:DashboardDays;from:string;asOf:string;usage?:UsageData;
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
 if(Object.keys(input).some(k=>!['days','page','documentId'].includes(k))||input.page!==undefined&&typeof input.page!=='string'&&typeof input.page!=='number')throw new Error('INVALID_INPUT');
 const days=rangeDays(input.days),page=input.page===undefined?1:Number(input.page);
 if(!Number.isSafeInteger(page)||page<1||page>999999||input.page!==undefined&&!/^[1-9]\d*$/.test(String(input.page)))throw new Error('INVALID_INPUT');
 const documentId=input.documentId;
 if(documentId!==undefined&&(typeof documentId!=='string'||!documentId.trim()||documentId!==documentId.trim()||documentId.length>200||/[\x00-\x1f\x7f]/.test(documentId)))throw new Error('INVALID_INPUT');
 return {days,page,documentId:documentId as string|undefined};
}
