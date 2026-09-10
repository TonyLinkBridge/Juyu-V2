import type {ContentKind} from '../domain/model.ts';
import {positiveInteger} from '../feedback/model.ts';
export interface RecentInput {revision:number}
export interface RecentReceipt {documentId:string;revision:number;viewedAt:string}
export interface RecentItem {id:string;title:string;kind:ContentKind;revision:number;tags:string[];viewedRevision:number;viewedAt:string}
export interface RecentPage {items:RecentItem[];total:number;page:number;pages:number}
export function recentInput(value:unknown):RecentInput {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('INVALID_INPUT');
 const input=value as Record<string,unknown>;
 if(Object.keys(input).length!==1||!Object.hasOwn(input,'revision'))throw new Error('INVALID_INPUT');
 return {revision:positiveInteger(input.revision)};
}
