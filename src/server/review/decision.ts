import {changeSavedPublication} from './publication.ts';
import type {PoolClient} from 'pg';
import type {Document,Viewer} from '../../domain/model.ts';
import {transition} from '../../domain/workflow.ts';
import {reviewId} from '../../review/model.ts';
import {decisionInput,type DecisionAck,type ReviewDetail} from '../../review/decision.ts';
import {loadDocument,persistDocumentTransition,readEditorSnapshot} from '../database/repository.ts';
interface Receipt {revision:number;submittedBy:string;reviewerId:string;reviewerName:string;status:string;reason:string|null;submittedAt:Date;decidedAt:Date|null;decidedBy:string|null;submittedSequence:number;locale:'zh-CN'|'en';englishQualityConfirmed:boolean}
async function requireCurrentAdmin(c:PoolClient,actor:Viewer){
 if(!(await c.query('SELECT juyu.is_admin() AND juyu.actor_id()=$1 AND juyu.review_admin_eligible($1) AS ok',[actor.id])).rows[0]?.ok)throw new Error('FORBIDDEN');
}
async function latestReceipt(c:PoolClient,id:string):Promise<Receipt|null>{
 return (await c.query<Receipt>(`SELECT r.revision_id AS revision,r.submitted_by AS "submittedBy",r.reviewer_id AS "reviewerId",m.display_name AS "reviewerName",r.status,r.reason,r.submitted_at AS "submittedAt",r.decided_at AS "decidedAt",r.decided_by AS "decidedBy",r.submitted_sequence AS "submittedSequence",d.locale,r.english_quality_confirmed AS "englishQualityConfirmed"
 FROM juyu.reviews r JOIN juyu.members m ON m.clerk_user_id=r.reviewer_id JOIN juyu.documents d ON d.id=r.document_id WHERE r.document_id=$1 ORDER BY r.submitted_sequence DESC LIMIT 1`,[id])).rows[0]??null;
}
function matchesReview(d:Document,r:Receipt|null){
 const w=d.workflow,submitted=d.audit.find(e=>e.sequence===r?.submittedSequence);
 return !!r&&r.revision===w.revisionId&&r.submittedBy===w.submittedBy&&r.reviewerId===w.reviewerId
  &&submitted?.action==='submit'&&submitted.revisionId===r.revision&&submitted.actorId===r.submittedBy;
}
function independentReviewer(d:Document,actor:Viewer){
 const w=d.workflow,revision=d.revisions.find(r=>r.id===w.revisionId);
 return !!revision&&w.reviewerId===actor.id&&![w.submittedBy,revision.authorId,revision.editorId].includes(actor.id);
}
export async function readReviewDetail(c:PoolClient,id:string,actor:Viewer):Promise<ReviewDetail>{
 reviewId(id);await requireCurrentAdmin(c,actor);const d=await loadDocument(c,id);if(!d)throw new Error('NOT_FOUND');
 const receipt=await latestReceipt(c,id);
 const review:ReviewDetail['review']=receipt?{revision:receipt.revision,submittedBy:receipt.submittedBy,reviewerId:receipt.reviewerId,reviewerName:receipt.reviewerName,status:receipt.status,reason:receipt.reason,submittedAt:receipt.submittedAt.toISOString(),decidedAt:receipt.decidedAt?.toISOString()??null}:null;
 return {article:await readEditorSnapshot(c,d),review,canDecide:d.lifecycle==='active'&&d.workflow.status==='in_review'&&receipt?.status==='in_review'&&matchesReview(d,receipt)&&independentReviewer(d,actor)};
}
export async function decideSavedReview(c:PoolClient,id:string,value:unknown,actor:Viewer):Promise<DecisionAck>{
 reviewId(id);const input=decisionInput(value);
 // Same lock order as submission and member changes: global, editor, document, members.
 if(!(await c.query('SELECT pg_try_advisory_xact_lock_shared(84620915) AS acquired')).rows[0]?.acquired)throw new Error('MEMBER_BUSY');
 await requireCurrentAdmin(c,actor);
 await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`editor:${id}`]);
 if(!(await c.query('SELECT id FROM juyu.documents WHERE id=$1 FOR UPDATE',[id])).rowCount)throw new Error('NOT_FOUND');
 await c.query('SELECT clerk_user_id FROM juyu.members WHERE clerk_user_id=ANY($1::text[]) ORDER BY clerk_user_id FOR SHARE',[[actor.id]]);
 await requireCurrentAdmin(c,actor);
 const d=await loadDocument(c,id);if(!d)throw new Error('NOT_FOUND');if(d.lifecycle!=='active')throw new Error('INACTIVE_DOCUMENT');
 const receipt=await latestReceipt(c,id),w=d.workflow,last=d.audit.at(-1),reason=input.action==='reject'?input.reason!:null;
 const combined=input.action==='approve_publish',approving=input.action!=='reject';
 const status=combined?'published':approving?'approved':'changes_requested',receiptStatus=approving?'approved':'rejected';
 const ack:DecisionAck={documentId:id,sequence:d.sequence,revision:w.revisionId,status,action:input.action,reason,reviewerId:actor.id};
 // A lost response may only acknowledge this exact three-step review/publication.
 // Reuse publication's immutable approval validation; never run the stages again.
 if(combined&&d.sequence===input.expectedSequence+3&&w.status==='published'&&independentReviewer(d,actor)&&matchesReview(d,receipt)){
  const events=d.audit.filter(event=>event.sequence>input.expectedSequence);
  if(events.length===3&&events.every((event,index)=>event.sequence===input.expectedSequence+index+1&&event.action===['approve','queue','publish'][index]&&event.actorId===actor.id&&event.reviewerId===actor.id&&event.previousReviewerId===actor.id&&event.revisionId===w.revisionId&&event.reason===null)
   &&receipt?.status==='approved'&&receipt.decidedBy===actor.id&&receipt.reason===null&&receipt.decidedAt?.toISOString()===events[0].at){
   const published=await changeSavedPublication(c,id,{expectedSequence:input.expectedSequence+2,action:'publish'},actor);
   return {...ack,publishedRevision:published.publishedRevision!};
  }
 }
 if(!combined&&d.sequence===input.expectedSequence+1&&w.status===status&&independentReviewer(d,actor)&&matchesReview(d,receipt)
  &&last?.action===input.action&&last.actorId===actor.id&&last.reviewerId===actor.id&&last.revisionId===w.revisionId&&last.reason===reason
  &&receipt?.status===receiptStatus&&receipt.decidedBy===actor.id&&receipt.reason===reason&&receipt.decidedAt?.toISOString()===last.at
  &&(input.action!=='approve'||receipt.locale!=='en'||receipt.englishQualityConfirmed))return ack;
 if(d.sequence!==input.expectedSequence)throw new Error('CONFLICT');
 if(w.status!=='in_review')throw new Error('INVALID_STATE');
 if(!independentReviewer(d,actor))throw new Error('NOT_REVIEWER');
 if(!matchesReview(d,receipt)||receipt?.status!=='in_review'||receipt.decidedBy!==null||receipt.decidedAt!==null)throw new Error('CONFLICT');
 if(approving&&receipt.locale==='en'&&!input.englishReviewConfirmed)throw new Error('ENGLISH_REVIEW_REQUIRED');
 const now=new Date().toISOString(),command=approving?{type:'approve' as const}:{type:'reject' as const,reason:reason!};
 const next=transition(d,command,actor,{expectedSequence:input.expectedSequence,now});
 await persistDocumentTransition(c,id,d,next,command,actor,now,approving&&receipt.locale==='en'&&input.englishReviewConfirmed===true);
 if(combined){
  // ScopedDatabase commits all stages together. Media, receipt or SQL failures
  // roll back approval, publication, history and notifications as one operation.
  const queued=await changeSavedPublication(c,id,{expectedSequence:next.sequence,action:'queue'},actor);
  const published=await changeSavedPublication(c,id,{expectedSequence:queued.sequence,action:'publish'},actor);
  return {...ack,sequence:published.sequence,publishedRevision:published.publishedRevision!};
 }
 return {...ack,sequence:next.sequence};
}
