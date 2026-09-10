import {positiveInteger} from '../feedback/model.ts';
import {parseSearchQuery} from '../reader/search.ts';
export interface AnalyticsSearchSnapshot {eventId:string;query:string;page:number;total:number;results:{documentId:string;revision:number}[]}
export type AnalyticsInput = {kind:'view';eventId:string;documentId:string;revision:number}
 | ({kind:'search'}&AnalyticsSearchSnapshot)
 | {kind:'search_click';eventId:string;documentId:string;revision:number;position:number;search:AnalyticsSearchSnapshot};
export interface AnalyticsReceipt {eventId:string;kind:AnalyticsInput['kind']}
function object(value:unknown,keys:string[]):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('INVALID_INPUT');
 const x=value as Record<string,unknown>;if(Object.keys(x).length!==keys.length||keys.some(key=>!Object.hasOwn(x,key)))throw new Error('INVALID_INPUT');return x;
}
function uuid(value:unknown):string {if(typeof value!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value))throw new Error('INVALID_INPUT');return value.toLowerCase();}
function documentId(value:unknown):string {if(typeof value!=='string'||!value.trim()||value!==value.trim()||[...value].length>200||/[\u0000-\u001f\u007f-\u009f]/u.test(value))throw new Error('INVALID_INPUT');return value;}
function snapshot(value:unknown):AnalyticsSearchSnapshot {
 const x=object(value,['eventId','query','page','total','results']);if(typeof x.query!=='string')throw new Error('INVALID_INPUT');const parsed=parseSearchQuery(x.query);
 if(parsed.status!=='ready'||typeof x.total!=='number'||!Number.isInteger(x.total)||x.total<0||x.total>2147483647||!Array.isArray(x.results)||x.results.length>20)throw new Error('INVALID_INPUT');const page=positiveInteger(x.page);if(page>999999)throw new Error('INVALID_INPUT');
 return {eventId:uuid(x.eventId),query:parsed.query,page,total:x.total,results:x.results.map(value=>{const r=object(value,['documentId','revision']);return {documentId:documentId(r.documentId),revision:positiveInteger(r.revision)};})};
}
export function analyticsInput(value:unknown):AnalyticsInput {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('INVALID_INPUT');const kind=(value as Record<string,unknown>).kind;
 if(kind==='search'){const x=object(value,['kind','eventId','query','page','total','results']);const rest={...x};delete rest.kind;return {kind,...snapshot(rest)};}
 if(kind==='view'){const x=object(value,['kind','eventId','documentId','revision']);return {kind,eventId:uuid(x.eventId),documentId:documentId(x.documentId),revision:positiveInteger(x.revision)};}
 if(kind==='search_click'){const x=object(value,['kind','eventId','documentId','revision','position','search']);return {kind,eventId:uuid(x.eventId),documentId:documentId(x.documentId),revision:positiveInteger(x.revision),position:positiveInteger(x.position),search:snapshot(x.search)};}
 throw new Error('INVALID_INPUT');
}
