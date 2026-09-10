import type {PoolClient} from 'pg';
import type {Viewer} from '../../domain/model.ts';
import {reviewId} from '../../review/model.ts';
import {positiveInteger} from '../../feedback/model.ts';
import {availabilityInput,type AvailabilityAck,type AvailabilityDetail,type AvailabilityHistory,type ArchivePage} from '../../availability/model.ts';
async function requireCurrentAdmin(c:PoolClient,actor:Viewer){
 if(!(await c.query('SELECT juyu.is_admin() AND juyu.actor_id()=$1 AND juyu.review_admin_eligible($1) AS ok',[actor.id])).rows[0]?.ok)throw new Error('FORBIDDEN');
}
export async function readAvailabilityDetail(c:PoolClient,id:string,actor:Viewer):Promise<AvailabilityDetail>{
 reviewId(id);await requireCurrentAdmin(c,actor);
 const d=(await c.query<Pick<AvailabilityDetail,'documentId'|'title'|'sequence'|'revision'|'lifecycle'|'status'|'publishedRevision'>>(`SELECT d.id AS "documentId",r.title,d.sequence,d.workflow_revision_id AS revision,d.lifecycle,d.workflow_state AS status,d.published_revision_id AS "publishedRevision"
 FROM juyu.documents d JOIN juyu.revisions r ON r.document_id=d.id AND r.revision_id=d.workflow_revision_id WHERE d.id=$1`,[id])).rows[0];
 if(!d)throw new Error('NOT_FOUND');
 const history=(await c.query<Omit<AvailabilityHistory,'at'>&{at:Date}>(`SELECT a.sequence,a.revision_id AS revision,a.action,a.actor_id AS "actorId",m.display_name AS "actorName",a.previous_published_revision_id AS "previousPublishedRevision",a.at
 FROM juyu.audit_log a JOIN juyu.members m ON m.clerk_user_id=a.actor_id WHERE a.document_id=$1 AND a.action IN('archive','unpublish','unarchive') ORDER BY a.sequence DESC LIMIT 21`,[id])).rows;
 return {...d,canArchive:d.lifecycle==='active',canUnpublish:d.lifecycle==='active'&&d.publishedRevision!==null,canUnarchive:d.lifecycle==='archived',history:history.slice(0,20).map(h=>({...h,at:h.at.toISOString()})),historyMore:history.length>20};
}
export async function changeSavedAvailability(c:PoolClient,id:string,value:unknown,actor:Viewer):Promise<AvailabilityAck>{
 reviewId(id);const input=availabilityInput(value);await requireCurrentAdmin(c,actor);
 // The secured command owns the locks, role recheck and complete atomic mutation.
 return (await c.query<AvailabilityAck>('SELECT document_id AS "documentId",sequence,revision,action,lifecycle,status,published_revision AS "publishedRevision" FROM juyu.change_document_availability($1,$2,$3)',[id,input.action,input.expectedSequence])).rows[0];
}
export async function readArchives(c:PoolClient,actor:Viewer,page=1):Promise<ArchivePage>{
 positiveInteger(page);await requireCurrentAdmin(c,actor);
 const total=(await c.query("SELECT count(*)::int AS n FROM juyu.documents WHERE lifecycle='archived'")).rows[0].n as number;
 const pages=Math.max(1,Math.ceil(total/30));page=Math.min(page,pages);
 const items=(await c.query<ArchivePage['items'][number]>(`SELECT d.id AS "documentId",r.title,d.sequence,d.workflow_revision_id AS revision FROM juyu.documents d JOIN juyu.revisions r ON r.document_id=d.id AND r.revision_id=d.workflow_revision_id
 WHERE d.lifecycle='archived' ORDER BY d.updated_at DESC,d.id COLLATE "C" LIMIT 30 OFFSET $1`,[(page-1)*30])).rows;
 return {items,total,page,pages};
}
