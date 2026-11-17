import {reviewId} from './model.ts';
import type {ControlAck} from './control.ts';
export const BULK_WITHDRAW_LIMIT=30;
export interface BulkWithdrawItem {documentId:string;expectedSequence:number;revision:number;publishedRevision:number|null}
export interface BulkWithdrawInput {items:BulkWithdrawItem[]}
export interface BulkWithdrawResult {items:(ControlAck&{publishedRevision:number|null})[]}
const record=(x:unknown):x is Record<string,unknown>=>Boolean(x)&&typeof x==='object'&&!Array.isArray(x);
export function bulkWithdrawInput(value:unknown):BulkWithdrawInput {
 if(!record(value)||Object.keys(value).length!==1||!Array.isArray(value.items)||value.items.length<1||value.items.length>BULK_WITHDRAW_LIMIT)throw new Error('INVALID_INPUT');
 const seen=new Set<string>();const items=value.items.map(item=>{
  if(!record(item)||Object.keys(item).length!==4||!['documentId','expectedSequence','revision','publishedRevision'].every(key=>Object.hasOwn(item,key)))throw new Error('INVALID_INPUT');
  const documentId=reviewId(item.documentId);
  if(documentId.includes('\0')||seen.has(documentId)||!Number.isSafeInteger(item.expectedSequence)||Number(item.expectedSequence)<0||Number(item.expectedSequence)>=2147483647||!Number.isSafeInteger(item.revision)||Number(item.revision)<1||!(item.publishedRevision===null||Number.isSafeInteger(item.publishedRevision)&&Number(item.publishedRevision)>0))throw new Error('INVALID_INPUT');
  seen.add(documentId);return {documentId,expectedSequence:Number(item.expectedSequence),revision:Number(item.revision),publishedRevision:item.publishedRevision as number|null};
 });return {items};
}
