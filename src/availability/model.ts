import type {Status} from '../domain/model.ts';
export type AvailabilityAction='archive'|'unpublish'|'unarchive';
export interface AvailabilityHistory {sequence:number;revision:number;action:AvailabilityAction;actorId:string;actorName:string;previousPublishedRevision:number|null;at:string}
export interface AvailabilityDetail {documentId:string;title:string;sequence:number;revision:number;lifecycle:'active'|'archived'|'trashed';status:Status;publishedRevision:number|null;canArchive:boolean;canUnpublish:boolean;canUnarchive:boolean;history:AvailabilityHistory[];historyMore:boolean}
export interface AvailabilityInput {expectedSequence:number;action:AvailabilityAction}
export interface AvailabilityAck {documentId:string;sequence:number;revision:number;action:AvailabilityAction;lifecycle:'active'|'archived';status:'draft';publishedRevision:null}
export interface ArchivePage {items:{documentId:string;title:string;sequence:number;revision:number}[];total:number;page:number;pages:number}
export function availabilityInput(value:unknown):AvailabilityInput {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('INVALID_INPUT');
 const x=value as Record<string,unknown>;
 if(Object.keys(x).some(k=>!['expectedSequence','action'].includes(k))||!Object.hasOwn(x,'expectedSequence')||!Object.hasOwn(x,'action')
  ||!Number.isSafeInteger(x.expectedSequence)||Number(x.expectedSequence)<0||Number(x.expectedSequence)>=2147483647
  ||(x.action!=='archive'&&x.action!=='unpublish'&&x.action!=='unarchive'))throw new Error('INVALID_INPUT');
 return {expectedSequence:Number(x.expectedSequence),action:x.action};
}
