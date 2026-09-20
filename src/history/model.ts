import type {FieldSnapshot} from '../fields/model.ts';
import type {QaMetadata} from '../qa/model.ts';
import type {Audience,Status} from '../domain/model.ts';
import type {ArticleCover} from '../domain/presentation.ts';
import type {MediaBlock} from '../media/model.ts';
export interface HistoryEvent {sequence:number;action:string;revision:number|null;actorId:string;actorName:string;reviewerId:string|null;reviewerName:string|null;previousReviewerId:string|null;previousReviewerName:string|null;reason:string|null;sourceRevision:number|null;previousPublishedRevision:number|null;at:string}
export interface VersionSummary {revision:number;title:string;authorId:string;authorName:string;editorId:string;editorName:string;createdAt:string}
export interface HistoryPage {documentId:string;title:string;sequence:number;revision:number|null;publishedRevision:number|null;lifecycle:'active'|'archived'|'trashed'|'purged';status:Status|null;events:HistoryEvent[];eventPage:number;eventPages:number;eventTotal:number;versions:VersionSummary[];versionPage:number;versionPages:number;versionTotal:number}
export interface HistoryVersion {documentId:string;sequence:number;currentRevision:number;publishedRevision:number|null;lifecycle:'active'|'archived'|'trashed';status:Status;version:VersionSummary & {description?:string;releaseNote?:string;customFields?:FieldSnapshot[];qa?:QaMetadata;body:string;audience:Audience;tags:string[];cover:ArticleCover|null;blocks:MediaBlock[]};categories:{id:string;name:string}[];assets:{id:string;filename:string;mime:string;size:string;status:string}[];canRestore:boolean}
export interface RestoreVersionInput {expectedSequence:number;sourceRevision:number}
export interface RestoreVersionAck {documentId:string;sequence:number;revision:number;sourceRevision:number;status:'draft';publishedRevision:number|null}
export function historyInteger(value:unknown,min=1,max=2147483647):number {
 if(!Number.isSafeInteger(value)||Number(value)<min||Number(value)>max)throw new Error('INVALID_INPUT');
 return Number(value);
}
export function restoreVersionInput(value:unknown):RestoreVersionInput {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('INVALID_INPUT');
 const x=value as Record<string,unknown>;
 if(Object.keys(x).length!==2||!Object.hasOwn(x,'expectedSequence')||!Object.hasOwn(x,'sourceRevision'))throw new Error('INVALID_INPUT');
 return {expectedSequence:historyInteger(x.expectedSequence,0,2147483646),sourceRevision:historyInteger(x.sourceRevision)};
}
export interface DeletedHistoryPage {items:{documentId:string;title:string;sequence:number;actorId:string;actorName:string;deletedAt:string}[];total:number;page:number;pages:number}
