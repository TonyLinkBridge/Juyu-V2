import type {ContentKind,Status,Document} from '../domain/model.ts';
export interface LifecycleItem {id:string;title:string;sequence:number;status:Status;lifecycle:Document['lifecycle'];kind:ContentKind;updatedAt:string}
export interface CleanupSummary {documentId:string;title:string;pending:number}
export interface LifecyclePage {items:LifecycleItem[];total:number;page:number;pages:number;cleanup:CleanupSummary[];cleanupTotal:number;cleanupPage:number;cleanupPages:number}
export interface LifecycleCommand {action:'trash'|'restore'|'purge';expectedSequence:number;confirmation?:string}
export interface LifecycleResult {documentId:string;action:LifecycleCommand['action'];sequence:number;cleanupPending:number}
/** Server-only object identity; never return these rows from an HTTP endpoint. */
export interface CleanupJob {id:string;object_key:string;bucket:string}
export function lifecycleInput(value:unknown):LifecycleCommand {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('INVALID_INPUT');
 const x=value as Record<string,unknown>;
 if(Object.keys(x).some(k=>!['action','expectedSequence','confirmation'].includes(k))||!['trash','restore','purge'].includes(String(x.action))||!Number.isSafeInteger(x.expectedSequence)||Number(x.expectedSequence)<0||Number(x.expectedSequence)>=2147483647)throw new Error('INVALID_INPUT');
 if(x.confirmation!==undefined&&(typeof x.confirmation!=='string'||x.confirmation.length>1000))throw new Error('INVALID_INPUT');
 if(x.action==='purge'&&(typeof x.confirmation!=='string'||!x.confirmation.trim()))throw new Error('CONFIRMATION_REQUIRED');
 if(x.action!=='purge'&&x.confirmation!==undefined)throw new Error('INVALID_INPUT');
 return {action:x.action as LifecycleCommand['action'],expectedSequence:Number(x.expectedSequence),...(x.confirmation!==undefined?{confirmation:x.confirmation as string}:{})};
}
export function lifecycleId(id:string):void {if(typeof id!=='string'||!id.trim()||id.length>200)throw new Error('INVALID_INPUT');}
