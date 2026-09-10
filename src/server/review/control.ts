import type {PoolClient} from 'pg';
import type {Document,Viewer} from '../../domain/model.ts';
import {transition} from '../../domain/workflow.ts';
import {reviewId,type Reviewer} from '../../review/model.ts';
import {controlInput,type ControlAck,type ControlDetail,type ControlHistory} from '../../review/control.ts';
import {loadDocument,persistDocumentTransition} from '../database/repository.ts';
interface Receipt {revision:number;submittedBy:string;reviewerId:string;status:string;decidedBy:string|null;decidedAt:Date|null;reason:string|null;submittedSequence:number}
async function requireCurrentAdmin(c:PoolClient,actor:Viewer){
 if(!(await c.query('SELECT juyu.is_admin() AND juyu.actor_id()=$1 AND juyu.review_admin_eligible($1) AS ok',[actor.id])).rows[0]?.ok)throw new Error('FORBIDDEN');
}
async function latestReceipt(c:PoolClient,id:string):Promise<Receipt|null>{
 return (await c.query<Receipt>(`SELECT revision_id AS revision,submitted_by AS "submittedBy",reviewer_id AS "reviewerId",status,decided_by AS "decidedBy",decided_at AS "decidedAt",reason,submitted_sequence AS "submittedSequence"
 FROM juyu.reviews WHERE document_id=$1 ORDER BY submitted_sequence DESC LIMIT 1`,[id])).rows[0]??null;
}
function originalSubmissionMatches(d:Document,r:Receipt|null){
 const submitted=d.audit.find(e=>e.sequence===r?.submittedSequence);
 return !!r&&r.revision===d.workflow.revisionId&&submitted?.action==='submit'&&submitted.revisionId===r.revision&&submitted.actorId===r.submittedBy;
}
function pendingMatches(d:Document,r:Receipt|null){
 return !!r&&originalSubmissionMatches(d,r)&&r.submittedBy===d.workflow.submittedBy&&r.reviewerId===d.workflow.reviewerId
  &&r.status==='in_review'&&r.decidedAt===null&&r.decidedBy===null&&r.reason===null;
}
export async function readControlDetail(c:PoolClient,id:string,actor:Viewer,after=''):Promise<ControlDetail>{
 reviewId(id);if(after!=='')reviewId(after);await requireCurrentAdmin(c,actor);
 const d=await loadDocument(c,id);if(!d)throw new Error('NOT_FOUND');
 const w=d.workflow,revision=d.revisions.find(r=>r.id===w.revisionId)!;
 const assigned=w.reviewerId?(await c.query<{name:string;available:boolean}>('SELECT display_name AS name,juyu.review_admin_eligible(clerk_user_id) AS available FROM juyu.members WHERE clerk_user_id=$1',[w.reviewerId])).rows[0]:undefined;
 const canManageReview=d.lifecycle==='active'&&w.status==='in_review'&&pendingMatches(d,await latestReceipt(c,id));
 const rows=canManageReview?(await c.query<Reviewer>(`SELECT clerk_user_id AS id,display_name AS name FROM juyu.members
 WHERE clerk_user_id COLLATE "C">$1 COLLATE "C" AND NOT(clerk_user_id=ANY($2::text[])) AND juyu.review_admin_eligible(clerk_user_id)
 ORDER BY clerk_user_id COLLATE "C" LIMIT 31`,[after,[actor.id,w.submittedBy,revision.authorId,revision.editorId,w.reviewerId].filter((x):x is string=>x!==null)])).rows:[];
 const history=(await c.query<Omit<ControlHistory,'at'>&{at:Date}>(`SELECT a.sequence,a.revision_id AS revision,a.action,a.actor_id AS "actorId",actor.display_name AS "actorName",a.previous_reviewer_id AS "previousReviewerId",previous.display_name AS "previousReviewerName",a.reviewer_id AS "reviewerId",reviewer.display_name AS "reviewerName",a.at
 FROM juyu.audit_log a JOIN juyu.members actor ON actor.clerk_user_id=a.actor_id LEFT JOIN juyu.members previous ON previous.clerk_user_id=a.previous_reviewer_id LEFT JOIN juyu.members reviewer ON reviewer.clerk_user_id=a.reviewer_id
 WHERE a.document_id=$1 AND a.action IN ('withdraw','reassign') ORDER BY a.sequence DESC LIMIT 21`,[id])).rows;
 const reviewers=rows.slice(0,30);
 return {documentId:id,title:revision.title,sequence:d.sequence,revision:w.revisionId,status:w.status,lifecycle:d.lifecycle,publishedRevision:d.publishedRevisionId,
  submittedBy:w.submittedBy,reviewerId:w.reviewerId,reviewerName:assigned?.name??null,reviewerAvailable:assigned?.available??false,canManageReview,
  reviewers,nextCursor:rows.length>30?reviewers.at(-1)!.id:null,history:history.slice(0,20).map(h=>({...h,at:h.at.toISOString()})),historyMore:history.length>20};
}
export async function changeSavedReviewControl(c:PoolClient,id:string,value:unknown,actor:Viewer):Promise<ControlAck>{
 reviewId(id);const input=controlInput(value);
 // Same order as submission, decisions and member management; old reviewers may be inactive.
 if(!(await c.query('SELECT pg_try_advisory_xact_lock_shared(84620915) AS acquired')).rows[0]?.acquired)throw new Error('MEMBER_BUSY');
 await requireCurrentAdmin(c,actor);
 await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`editor:${id}`]);
 if(!(await c.query('SELECT id FROM juyu.documents WHERE id=$1 FOR UPDATE',[id])).rowCount)throw new Error('NOT_FOUND');
 await c.query('SELECT clerk_user_id FROM juyu.members WHERE clerk_user_id=ANY($1::text[]) ORDER BY clerk_user_id FOR SHARE',[[actor.id,...(input.reviewerId?[input.reviewerId]:[])].sort()]);
 await requireCurrentAdmin(c,actor);
 const d=await loadDocument(c,id);if(!d)throw new Error('NOT_FOUND');if(d.lifecycle!=='active')throw new Error('INACTIVE_DOCUMENT');
 const w=d.workflow,last=d.audit.at(-1),receipt=await latestReceipt(c,id),target=input.reviewerId??null,status=input.action==='withdraw'?'draft':'in_review';
 const exactEvent=d.sequence===input.expectedSequence+1&&last?.sequence===d.sequence&&last.action===input.action&&last.actorId===actor.id
  &&last.revisionId===w.revisionId&&last.reviewerId===target&&last.previousReviewerId!==null&&last.reason===null&&w.status===status&&w.reviewerId===target;
 const exactReceipt=input.action==='reassign'?pendingMatches(d,receipt):!!receipt&&originalSubmissionMatches(d,receipt)&&receipt.status==='withdrawn'
  &&receipt.reviewerId===last?.previousReviewerId&&receipt.decidedBy===actor.id&&receipt.decidedAt?.toISOString()===last?.at&&receipt.reason===null&&w.submittedBy===null;
 if(exactEvent&&exactReceipt)return {documentId:id,sequence:d.sequence,revision:w.revisionId,action:input.action,status,previousReviewerId:last!.previousReviewerId,reviewerId:target};
 if(d.sequence!==input.expectedSequence)throw new Error('CONFLICT');
 if(w.status!=='in_review')throw new Error('INVALID_STATE');
 if(!pendingMatches(d,receipt))throw new Error('CONFLICT');
 if(input.action==='reassign'){
  const revision=d.revisions.find(r=>r.id===w.revisionId)!;
  if([actor.id,w.submittedBy,revision.authorId,revision.editorId,w.reviewerId].includes(target)
   ||!(await c.query('SELECT juyu.review_admin_eligible($1) AS ok',[target])).rows[0]?.ok)throw new Error('INVALID_REVIEWER');
 }
 const now=new Date().toISOString(),command={type:input.action},reviewer=input.action==='reassign'?{id:target!,role:'admin' as const,companyVerified:true}:undefined;
 const next=transition(d,command,actor,{expectedSequence:input.expectedSequence,now,reviewer});
 await persistDocumentTransition(c,id,d,next,command,actor,now);
 return {documentId:id,sequence:next.sequence,revision:w.revisionId,action:input.action,status,previousReviewerId:w.reviewerId,reviewerId:target};
}
