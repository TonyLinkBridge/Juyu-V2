import type {PoolClient} from 'pg';
import {positiveInteger} from '../../feedback/model.ts';
import {lifecycleInput,lifecycleId,type LifecyclePage,type LifecycleItem,type LifecycleResult,type CleanupJob,type CleanupSummary} from '../../lifecycle/model.ts';
async function requireAdmin(c:PoolClient){if(!(await c.query('SELECT juyu.is_admin() AS allowed')).rows[0].allowed)throw new Error('FORBIDDEN');}
export async function readTrash(c:PoolClient,page=1,cleanupPage=1):Promise<LifecyclePage>{
 positiveInteger(page);positiveInteger(cleanupPage);await requireAdmin(c);
 const total=(await c.query("SELECT count(*)::int AS n FROM juyu.documents WHERE lifecycle='trashed'")).rows[0].n as number;
 const pages=Math.max(1,Math.ceil(total/30));page=Math.min(page,pages);
 const items=(await c.query<Omit<LifecycleItem,'updatedAt'>&{updated_at:Date}>(`SELECT d.id,r.title,d.sequence,d.workflow_state AS status,d.lifecycle,d.kind,d.updated_at FROM juyu.documents d JOIN juyu.revisions r ON r.document_id=d.id AND r.revision_id=d.workflow_revision_id WHERE d.lifecycle='trashed' ORDER BY d.updated_at DESC,d.id COLLATE "C" LIMIT 30 OFFSET $1`,[(page-1)*30])).rows.map(({updated_at,...x})=>({...x,updatedAt:updated_at.toISOString()}));
 const cleanupTotal=(await c.query('SELECT count(*)::int AS n FROM juyu.deletion_receipts r WHERE EXISTS(SELECT 1 FROM juyu.storage_cleanup_jobs j WHERE j.document_id=r.document_id AND j.completed_at IS NULL)')).rows[0].n as number;
 const cleanupPages=Math.max(1,Math.ceil(cleanupTotal/30));cleanupPage=Math.min(cleanupPage,cleanupPages);
 const cleanup=(await c.query<CleanupSummary>(`SELECT r.document_id AS "documentId",r.title,count(*)::int AS pending FROM juyu.deletion_receipts r JOIN juyu.storage_cleanup_jobs j ON j.document_id=r.document_id AND j.completed_at IS NULL GROUP BY r.document_id ORDER BY r.deleted_at DESC,r.document_id COLLATE "C" LIMIT 30 OFFSET $1`,[(cleanupPage-1)*30])).rows;
 return {items,total,page,pages,cleanup,cleanupTotal,cleanupPage,cleanupPages};
}
export async function changeLifecycle(c:PoolClient,id:string,input:unknown):Promise<LifecycleResult>{
 lifecycleId(id);const x=lifecycleInput(input);
 const row=(await c.query<{document_id:string;action:LifecycleResult['action'];sequence:number;cleanup_pending:number}>('SELECT * FROM juyu.change_document_lifecycle($1,$2,$3,$4)',[id,x.action,x.expectedSequence,x.confirmation??null])).rows[0];
 return {documentId:row.document_id,action:row.action,sequence:row.sequence,cleanupPending:row.cleanup_pending};
}
async function requireDeletionReceipt(c:PoolClient,id:string):Promise<void>{
 lifecycleId(id);await requireAdmin(c);
 if(!(await c.query('SELECT 1 FROM juyu.deletion_receipts WHERE document_id=$1',[id])).rowCount)throw new Error('NOT_FOUND');
}
export async function cleanupJobs(c:PoolClient,id:string):Promise<CleanupJob[]>{await requireDeletionReceipt(c,id);return (await c.query<CleanupJob>('SELECT id,object_key,bucket FROM juyu.storage_cleanup_jobs WHERE document_id=$1 AND completed_at IS NULL ORDER BY last_attempt_at NULLS FIRST,id LIMIT 25',[id])).rows;}
export async function startCleanupAttempt(c:PoolClient,id:string,key:string):Promise<void>{lifecycleId(id);if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key))throw new Error('INVALID_INPUT');await c.query('SELECT juyu.start_storage_cleanup_attempt($1,$2)',[id,key]);}
export async function cleanupPending(c:PoolClient,id:string):Promise<number>{await requireDeletionReceipt(c,id);return (await c.query('SELECT count(*)::int AS n FROM juyu.storage_cleanup_jobs WHERE document_id=$1 AND completed_at IS NULL',[id])).rows[0].n;}
export async function finishCleanup(c:PoolClient,id:string,key:string):Promise<void>{lifecycleId(id);if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key))throw new Error('INVALID_INPUT');await c.query('SELECT juyu.finish_storage_cleanup($1,$2)',[id,key]);}
