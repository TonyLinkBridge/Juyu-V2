import type {Document,Status} from '../domain/model.ts';
import {reviewId,type Reviewer} from './model.ts';
export interface ControlHistory {
 sequence:number;revision:number;action:'withdraw'|'reassign';actorId:string;actorName:string;
 previousReviewerId:string|null;previousReviewerName:string|null;reviewerId:string|null;reviewerName:string|null;at:string;
}
export interface ControlDetail {
 documentId:string;title:string;sequence:number;revision:number;status:Status;lifecycle:Document['lifecycle'];publishedRevision:number|null;
 submittedBy:string|null;reviewerId:string|null;reviewerName:string|null;reviewerAvailable:boolean;canManageReview:boolean;
 reviewers:Reviewer[];nextCursor:string|null;history:ControlHistory[];historyMore:boolean;
}
export interface ControlInput {expectedSequence:number;action:'withdraw'|'reassign';reviewerId?:string}
export interface ControlAck {documentId:string;sequence:number;revision:number;action:'withdraw'|'reassign';status:'draft'|'in_review';previousReviewerId:string|null;reviewerId:string|null}
export function controlInput(value:unknown):ControlInput {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('INVALID_INPUT');
 const x=value as Record<string,unknown>;
 if(Object.keys(x).some(k=>!['expectedSequence','action','reviewerId'].includes(k))||!Object.hasOwn(x,'expectedSequence')||!Object.hasOwn(x,'action')
  ||!Number.isSafeInteger(x.expectedSequence)||Number(x.expectedSequence)<0||Number(x.expectedSequence)>=2147483647
  ||(x.action!=='withdraw'&&x.action!=='reassign')||(x.action==='withdraw'&&Object.hasOwn(x,'reviewerId')))throw new Error('INVALID_INPUT');
 const reviewerId=x.action==='reassign'?reviewId(x.reviewerId):undefined;
 if(reviewerId?.includes('\0'))throw new Error('INVALID_INPUT');
 return {expectedSequence:Number(x.expectedSequence),action:x.action,...(reviewerId?{reviewerId}:{})};
}
