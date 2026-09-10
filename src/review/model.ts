import type {Document,Status} from '../domain/model.ts';
export interface Reviewer {id:string;name:string}
export interface ReviewerOptions {documentId:string;sequence:number;revision:number;status:Status;lifecycle:Document['lifecycle'];reviewers:Reviewer[];nextCursor:string|null}
export interface SubmitReviewInput {expectedSequence:number;reviewerId:string}
export interface SubmitReviewResult {documentId:string;sequence:number;revision:number;reviewerId:string;status:'in_review'}
export function reviewId(value:unknown):string {
 if(typeof value!=='string'||!value.trim()||value!==value.trim()||value.length>200)throw new Error('INVALID_INPUT');
 return value;
}
export function submissionInput(value:unknown):SubmitReviewInput {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('INVALID_INPUT');
 const x=value as Record<string,unknown>;
 if(Object.keys(x).length!==2||!Object.hasOwn(x,'expectedSequence')||!Object.hasOwn(x,'reviewerId')||!Number.isSafeInteger(x.expectedSequence)||Number(x.expectedSequence)<0||Number(x.expectedSequence)>=2147483647)throw new Error('INVALID_INPUT');
 return {expectedSequence:Number(x.expectedSequence),reviewerId:reviewId(x.reviewerId)};
}
