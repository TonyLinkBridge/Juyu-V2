import type {EditorData} from '../editor/contract.ts';
export interface PublicationHistory {sequence:number;revision:number;action:'queue'|'publish';actorId:string;actorName:string;at:string}
export interface PublicationDetail {
 article:EditorData;revision:number;approval:null|{revision:number;reviewerId:string;reviewerName:string;approvedAt:string};
 canQueue:boolean;canPublish:boolean;history:PublicationHistory[];historyMore:boolean;
}
export interface PublicationInput {expectedSequence:number;action:'queue'|'publish'}
export interface PublicationAck {documentId:string;sequence:number;revision:number;action:'queue'|'publish';status:'queued'|'published';publishedRevision:number|null;approvedBy:string}
export function publicationInput(value:unknown):PublicationInput {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('INVALID_INPUT');
 const x=value as Record<string,unknown>;
 if(Object.keys(x).some(k=>!['expectedSequence','action'].includes(k))||!Object.hasOwn(x,'expectedSequence')||!Object.hasOwn(x,'action')
  ||!Number.isSafeInteger(x.expectedSequence)||Number(x.expectedSequence)<0||Number(x.expectedSequence)>=2147483647
  ||(x.action!=='queue'&&x.action!=='publish'))throw new Error('INVALID_INPUT');
 return {expectedSequence:Number(x.expectedSequence),action:x.action};
}
