import type {PoolClient} from 'pg';
import type {Command} from '../../domain/workflow.ts';
import type {Document,Viewer} from '../../domain/model.ts';
import {notificationEvent} from './notification-event.ts';

/** Enqueue in the same transaction as the immutable audit row. */
export async function queueSlackNotification(client:PoolClient,before:Document,after:Document,command:Command,actor:Viewer){
 const event=notificationEvent(command.type,before.workflow.status,before.publishedRevisionId);
 if(!event)return;
 const revision=after.revisions.find(item=>item.id===after.workflow.revisionId)!;
 const labels=(await client.query<{locale:string;actorName:string;reviewerName:string|null;restricted:boolean}>(`
  WITH RECURSIVE category_lineage AS (
   SELECT c.id,c.parent_id,c.audience FROM juyu.categories c WHERE c.id=ANY($4::uuid[])
   UNION
   SELECT c.id,c.parent_id,c.audience FROM juyu.categories c JOIN category_lineage child ON child.parent_id=c.id
  )
  SELECT d.locale,m.display_name AS "actorName",reviewer.display_name AS "reviewerName",
   EXISTS(SELECT 1 FROM category_lineage WHERE audience<>'staff') AS restricted
  FROM juyu.documents d JOIN juyu.members m ON m.clerk_user_id=$2
  LEFT JOIN juyu.members reviewer ON reviewer.clerk_user_id=$3 WHERE d.id=$1`,
  [after.id,actor.id,after.workflow.reviewerId,revision.categoryIds??[]])).rows[0];
 if(!labels)throw new Error('SLACK_OUTBOX_METADATA_MISSING');
 // Channel membership is not the same as article permission. Restricted titles
 // stay behind the application's normal authorization checks.
 const title=revision.audience==='staff'&&!labels.restricted?revision.title:null;
 await client.query(`INSERT INTO juyu.slack_outbox(document_id,sequence,event,kind,locale,title,actor_id,actor_name,reviewer_name)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
  [after.id,after.sequence,event,after.kind,labels.locale,title,actor.id,labels.actorName,labels.reviewerName]);
}
