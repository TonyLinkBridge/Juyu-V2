import type {EditorData} from '../editor/contract.ts';
export interface ReviewDetail {
 article:EditorData;
 review:null|{revision:number;submittedBy:string;reviewerId:string;reviewerName:string;status:string;reason:string|null;submittedAt:string;decidedAt:string|null};
 canDecide:boolean;
}
export interface DecisionInput {expectedSequence:number;action:'approve'|'reject';reason?:string}
export interface DecisionAck {documentId:string;sequence:number;revision:number;status:'approved'|'changes_requested';action:'approve'|'reject';reason:string|null;reviewerId:string}
export function decisionInput(value:unknown):DecisionInput {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('INVALID_INPUT');
 const x=value as Record<string,unknown>;
 if(Object.keys(x).some(k=>!['expectedSequence','action','reason'].includes(k))||!Object.hasOwn(x,'expectedSequence')||!Object.hasOwn(x,'action')
  ||!Number.isSafeInteger(x.expectedSequence)||Number(x.expectedSequence)<0||Number(x.expectedSequence)>=2147483647||!['approve','reject'].includes(String(x.action))||typeof x.action!=='string')throw new Error('INVALID_INPUT');
 if(Object.hasOwn(x,'reason')&&typeof x.reason!=='string')throw new Error('INVALID_INPUT');
 const reason=typeof x.reason==='string'?x.reason.trim():'';
 if(reason.length>2000||reason.includes('\0')||(x.action==='approve'&&reason))throw new Error('INVALID_INPUT');
 if(x.action==='reject'&&!reason)throw new Error('REASON_REQUIRED');
 return {expectedSequence:Number(x.expectedSequence),action:x.action as DecisionInput['action'],...(x.action==='reject'?{reason}:{})};
}
