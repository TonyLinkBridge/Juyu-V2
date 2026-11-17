import type {PoolClient} from 'pg';
import type {Viewer} from '../../domain/model.ts';
import {bulkWithdrawInput,type BulkWithdrawResult} from '../../review/bulk-withdraw.ts';
import {loadDocument} from '../database/repository.ts';
import {changeSavedReviewControl} from './control.ts';
/** One ScopedDatabase transaction: no item, audit or receipt can commit separately. */
export async function withdrawSavedReviews(c:PoolClient,value:unknown,actor:Viewer):Promise<BulkWithdrawResult>{
 const {items}=bulkWithdrawInput(value);
 if(!(await c.query('SELECT pg_try_advisory_xact_lock_shared(84620915) AS acquired')).rows[0]?.acquired)throw new Error('MEMBER_BUSY');
 if(!(await c.query('SELECT juyu.is_admin() AND juyu.actor_id()=$1 AND juyu.review_admin_eligible($1) AS ok',[actor.id])).rows[0]?.ok)throw new Error('FORBIDDEN');
 // All batches acquire editor and row locks in the same order, including reversed retries.
 const ordered=[...items].sort((a,b)=>a.documentId<b.documentId?-1:a.documentId>b.documentId?1:0);
 for(const item of ordered)await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`editor:${item.documentId}`]);
 for(const item of ordered)if(!(await c.query('SELECT id FROM juyu.documents WHERE id=$1 FOR UPDATE',[item.documentId])).rowCount)throw new Error('NOT_FOUND');
 let retries=0;
 for(const item of ordered){
  const d=await loadDocument(c,item.documentId);if(!d)throw new Error('NOT_FOUND');
  if(d.lifecycle!=='active')throw new Error('INACTIVE_DOCUMENT');
  if(d.workflow.revisionId!==item.revision||d.publishedRevisionId!==item.publishedRevision)throw new Error('CONFLICT');
  if(d.sequence===item.expectedSequence+1&&d.workflow.status==='draft')retries++;
  else if(d.sequence!==item.expectedSequence||d.workflow.status!=='in_review')throw new Error('CONFLICT');
 }
 // A single exact retry must not turn a mixture of old and new selections into a new batch.
 if(retries!==0&&retries!==items.length)throw new Error('CONFLICT');
 const results=new Map<string,BulkWithdrawResult['items'][number]>();
 for(const item of ordered){const ack=await changeSavedReviewControl(c,item.documentId,{expectedSequence:item.expectedSequence,action:'withdraw'},actor);results.set(item.documentId,{...ack,publishedRevision:item.publishedRevision});}
 return {items:items.map(item=>results.get(item.documentId)!)};
}
