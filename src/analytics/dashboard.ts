import type {ContentKind} from '../domain/model.ts';
export type DashboardDays=7|30|90;
export interface SearchGroup {fingerprint:string;searches:number;zeroResults:number;clickedSearches:number}
export interface PopularArticle {documentId:string;title:string;kind:ContentKind;revision:number;views:number}
export interface NegativeFeedback {documentId:string;title:string;kind:ContentKind;revision:number;total:number;negative:number}
export interface DashboardData {
 days:DashboardDays;from:string;asOf:string;
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
