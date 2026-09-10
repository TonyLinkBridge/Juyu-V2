import type {PoolClient} from 'pg';
import type {Viewer} from '../../domain/model.ts';
import {transition} from '../../domain/workflow.ts';
import {reviewId,submissionInput,type Reviewer,type ReviewerOptions,type SubmitReviewResult} from '../../review/model.ts';
import {loadDocument,persistDocumentTransition} from '../database/repository.ts';
async function requireCurrentAdmin(c:PoolClient,actor:Viewer){
 if(!(await c.query('SELECT juyu.is_admin() AND juyu.actor_id()=$1 AND juyu.review_admin_eligible($1) AS ok',[actor.id])).rows[0]?.ok)throw new Error('FORBIDDEN');
}
export async function readReviewers(c:PoolClient,id:string,actor:Viewer,after=''):Promise<ReviewerOptions>{
 reviewId(id);if(after!=='')reviewId(after);await requireCurrentAdmin(c,actor);
 const d=(await c.query(`SELECT d.sequence,d.workflow_revision_id AS revision,d.workflow_state AS status,d.lifecycle,r.author_id,r.editor_id
  FROM juyu.documents d JOIN juyu.revisions r ON r.document_id=d.id AND r.revision_id=d.workflow_revision_id WHERE d.id=$1`,[id])).rows[0];
 if(!d)throw new Error('NOT_FOUND');
 const rows=(await c.query<Reviewer>(`SELECT clerk_user_id AS id,display_name AS name FROM juyu.members
  WHERE clerk_user_id COLLATE "C">$1 COLLATE "C" AND NOT(clerk_user_id=ANY($2::text[])) AND juyu.review_admin_eligible(clerk_user_id)
  ORDER BY clerk_user_id COLLATE "C" LIMIT 31`,[after,[actor.id,d.author_id,d.editor_id]])).rows;
 const reviewers=rows.slice(0,30);
 return {documentId:id,sequence:d.sequence,revision:d.revision,status:d.status,lifecycle:d.lifecycle,reviewers,nextCursor:rows.length>30?reviewers.at(-1)!.id:null};
}
export async function submitSavedReview(c:PoolClient,id:string,value:unknown,actor:Viewer):Promise<SubmitReviewResult>{
 reviewId(id);const input=submissionInput(value);
 // Member management/enrollment uses the matching exclusive session lock. Holding
 // its shared transaction lock excludes new pending changes until this commit.
 if(!(await c.query('SELECT pg_try_advisory_xact_lock_shared(84620915) AS acquired')).rows[0]?.acquired)throw new Error('MEMBER_BUSY');
 await requireCurrentAdmin(c,actor);
 await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`editor:${id}`]);
 const locked=await c.query('SELECT id FROM juyu.documents WHERE id=$1 FOR UPDATE',[id]);
 if(!locked.rowCount)throw new Error('NOT_FOUND');
 // Sorted row locks serialize observed-role/disable updates from authentication.
 await c.query('SELECT clerk_user_id FROM juyu.members WHERE clerk_user_id=ANY($1::text[]) ORDER BY clerk_user_id FOR SHARE',[[actor.id,input.reviewerId].sort()]);
 await requireCurrentAdmin(c,actor);
 const document=await loadDocument(c,id);if(!document)throw new Error('NOT_FOUND');
 if(document.lifecycle!=='active')throw new Error('INACTIVE_DOCUMENT');
 const last=document.audit.at(-1),w=document.workflow;
 const ack:SubmitReviewResult={documentId:id,sequence:document.sequence,revision:w.revisionId,reviewerId:input.reviewerId,status:'in_review'};
 if(document.sequence===input.expectedSequence+1&&w.status==='in_review'&&w.submittedBy===actor.id&&w.reviewerId===input.reviewerId
  &&last?.action==='submit'&&last.actorId===actor.id&&last.reviewerId===input.reviewerId&&last.revisionId===w.revisionId){
  // Retry acknowledges an immutable already-committed submission; it does not
  // assign a reviewer anew, even if that reviewer was subsequently disabled.
  const receipt=(await c.query("SELECT 1 FROM juyu.reviews WHERE document_id=$1 AND submitted_sequence=$2 AND revision_id=$3 AND submitted_by=$4 AND reviewer_id=$5 AND status='in_review'",[id,document.sequence,w.revisionId,actor.id,input.reviewerId])).rowCount;
  if(receipt)return ack;
 }
 if(document.sequence!==input.expectedSequence)throw new Error('CONFLICT');
 if(w.status==='changes_requested')throw new Error('EDIT_REQUIRED');
 if(!(await c.query('SELECT juyu.review_admin_eligible($1) AS ok',[input.reviewerId])).rows[0]?.ok)throw new Error('INVALID_REVIEWER');
 if((await c.query("SELECT 1 FROM juyu.assets WHERE document_id=$1 AND status='pending' LIMIT 1",[id])).rowCount)throw new Error('UPLOAD_IN_PROGRESS');
 const reviewer:Viewer={id:input.reviewerId,role:'admin',companyVerified:true};
 const now=new Date().toISOString(),command={type:'submit' as const};
 const next=transition(document,command,actor,{expectedSequence:input.expectedSequence,reviewer,now});
 await persistDocumentTransition(c,id,document,next,command,actor,now);
 return {...ack,sequence:next.sequence};
}
