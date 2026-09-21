import type {PoolClient} from 'pg';
import type {Document,Viewer} from '../../domain/model.ts';
import {COVER_MIME_TYPES} from '../../domain/presentation.ts';
import {blockAssetIds} from '../../media/model.ts';
import {transition} from '../../domain/workflow.ts';
import {reviewId} from '../../review/model.ts';
import {publicationInput,type PublicationAck,type PublicationDetail,type PublicationHistory} from '../../review/publication.ts';
import {loadDocument,persistDocumentTransition,readEditorSnapshot} from '../database/repository.ts';
interface Receipt {revision:number;submittedBy:string;reviewerId:string;reviewerName:string;status:string;reason:string|null;submittedAt:Date;decidedAt:Date|null;decidedBy:string|null;submittedSequence:number;locale:'zh-CN'|'en';englishQualityConfirmed:boolean}
async function requireCurrentAdmin(c:PoolClient,actor:Viewer){
 if(!(await c.query('SELECT juyu.is_admin() AND juyu.actor_id()=$1 AND juyu.review_admin_eligible($1) AS ok',[actor.id])).rows[0]?.ok)throw new Error('FORBIDDEN');
}
async function latestReceipt(c:PoolClient,id:string):Promise<Receipt|null>{
 return (await c.query<Receipt>(`SELECT r.revision_id AS revision,r.submitted_by AS "submittedBy",r.reviewer_id AS "reviewerId",m.display_name AS "reviewerName",r.status,r.reason,r.submitted_at AS "submittedAt",r.decided_at AS "decidedAt",r.decided_by AS "decidedBy",r.submitted_sequence AS "submittedSequence",d.locale,r.english_quality_confirmed AS "englishQualityConfirmed"
 FROM juyu.reviews r JOIN juyu.members m ON m.clerk_user_id=r.reviewer_id JOIN juyu.documents d ON d.id=r.document_id WHERE r.document_id=$1 ORDER BY r.submitted_sequence DESC LIMIT 1`,[id])).rows[0]??null;
}
function matchingApproval(d:Document,r:Receipt|null):r is Receipt {
 const w=d.workflow,revision=d.revisions.find(v=>v.id===w.revisionId),submitted=d.audit.find(e=>e.sequence===r?.submittedSequence);
 if(!r||!revision||!['approved','queued','published'].includes(w.status)||(r.locale==='en'&&!r.englishQualityConfirmed)||r.revision!==w.revisionId||r.submittedBy!==w.submittedBy
  ||r.reviewerId!==w.reviewerId||w.approvedBy!==r.reviewerId||r.decidedBy!==r.reviewerId||r.status!=='approved'||r.reason!==null||!r.decidedAt
  ||[r.submittedBy,revision.authorId,revision.editorId].includes(r.reviewerId)||submitted?.action!=='submit'||submitted.revisionId!==r.revision
  ||submitted.actorId!==r.submittedBy||submitted.at!==r.submittedAt.toISOString())return false;
 // Trace this review round, including legitimate reassignment, rather than accepting
 // a matching-looking receipt disconnected from its immutable approval evidence.
 let reviewer=submitted.reviewerId,approved=false,stage='in_review',sequence=r.submittedSequence;
 for(const event of d.audit.filter(e=>e.sequence>r.submittedSequence)){
  if(event.sequence!==++sequence||event.revisionId!==r.revision||event.reason!==null)return false;
  if(event.action==='reassign'&&!approved){if(event.previousReviewerId!==reviewer)return false;reviewer=event.reviewerId;continue;}
  if(event.action==='approve'&&!approved&&event.actorId===r.reviewerId&&event.reviewerId===reviewer&&reviewer===r.reviewerId
    &&event.previousReviewerId===reviewer&&event.at===r.decidedAt.toISOString()){approved=true;stage='approved';continue;}
  if(event.action==='queue'&&stage==='approved'&&event.reviewerId===reviewer&&event.previousReviewerId===reviewer){stage='queued';continue;}
  if(event.action==='publish'&&stage==='queued'&&event.reviewerId===reviewer&&event.previousReviewerId===reviewer){stage='published';continue;}
  return false;
 }
 return approved&&sequence===d.sequence&&stage===w.status&&(w.status!=='published'||d.publishedRevisionId===w.revisionId);
}
async function requireReadyAssets(c:PoolClient,d:Document){
 // The document lock also serializes new upload reservations. Existing uploads
 // and quarantine updates serialize on each referenced asset before status recheck.
 if((await c.query("SELECT 1 FROM juyu.assets WHERE document_id=$1 AND status='pending' LIMIT 1",[d.id])).rowCount)throw new Error('UPLOAD_IN_PROGRESS');
 const revision=d.revisions.find(r=>r.id===d.workflow.revisionId)!;
 const associations=(await c.query<{asset_id:string;usage:string}>('SELECT asset_id,usage FROM juyu.revision_assets WHERE document_id=$1 AND revision_id=$2',[d.id,revision.id])).rows;
 const ids=[...new Set([...associations.map(a=>a.asset_id),...(revision.cover?[revision.cover.assetId]:[]),...(revision.blocks??[]).flatMap(blockAssetIds)])].sort();
 const assets=(await c.query<{id:string;document_id:string;status:string;mime_type:string}>('SELECT id,document_id,status,mime_type FROM juyu.assets WHERE id=ANY($1::uuid[]) ORDER BY id FOR SHARE',[ids])).rows;
 if(assets.length!==ids.length||assets.some(a=>a.document_id!==d.id||a.status!=='ready'))throw new Error('INVALID_MEDIA');
 if(revision.cover&&(!associations.some(a=>a.asset_id===revision.cover!.assetId&&a.usage==='cover')||!COVER_MIME_TYPES.some(m=>m===assets.find(a=>a.id===revision.cover!.assetId)!.mime_type)))throw new Error('INVALID_MEDIA');
 for(const b of revision.blocks??[]){if(!('assetId' in b))continue;const asset=assets.find(a=>a.id===b.assetId)!;
  if(!associations.some(a=>a.asset_id===b.assetId&&a.usage==='inline')||(b.type==='image'&&!COVER_MIME_TYPES.some(m=>m===asset.mime_type))||(b.type==='video'&&!['video/mp4','video/webm'].includes(asset.mime_type))||(b.type==='audio'&&!['audio/mpeg','audio/ogg'].includes(asset.mime_type)))throw new Error('INVALID_MEDIA');
  if(b.type==='image'&&b.darkAssetId){const alternate=assets.find(a=>a.id===b.darkAssetId);if(!alternate||!associations.some(a=>a.asset_id===b.darkAssetId&&a.usage==='inline')||!COVER_MIME_TYPES.some(m=>m===alternate.mime_type))throw new Error('INVALID_MEDIA');}
 }
}
export async function readPublicationDetail(c:PoolClient,id:string,actor:Viewer):Promise<PublicationDetail>{
 reviewId(id);await requireCurrentAdmin(c,actor);const d=await loadDocument(c,id);if(!d)throw new Error('NOT_FOUND');if(d.lifecycle!=='active')throw new Error('INACTIVE_DOCUMENT');
 const receipt=await latestReceipt(c,id),valid=matchingApproval(d,receipt);
 const history=(await c.query<Omit<PublicationHistory,'at'>&{at:Date}>(`SELECT a.sequence,a.revision_id AS revision,a.action,a.actor_id AS "actorId",m.display_name AS "actorName",a.at
 FROM juyu.audit_log a JOIN juyu.members m ON m.clerk_user_id=a.actor_id WHERE a.document_id=$1 AND a.action IN ('queue','publish') ORDER BY a.sequence DESC LIMIT 21`,[id])).rows;
 return {article:await readEditorSnapshot(c,d),revision:d.workflow.revisionId,approval:valid?{revision:receipt.revision,reviewerId:receipt.reviewerId,reviewerName:receipt.reviewerName,approvedAt:receipt.decidedAt!.toISOString()}:null,
  canQueue:valid&&d.workflow.status==='approved',canPublish:valid&&d.workflow.status==='queued',history:history.slice(0,20).map(h=>({...h,at:h.at.toISOString()})),historyMore:history.length>20};
}
export async function changeSavedPublication(c:PoolClient,id:string,value:unknown,actor:Viewer):Promise<PublicationAck>{
 reviewId(id);const input=publicationInput(value);
 if(!(await c.query('SELECT pg_try_advisory_xact_lock_shared(84620915) AS acquired')).rows[0]?.acquired)throw new Error('MEMBER_BUSY');
 await requireCurrentAdmin(c,actor);
 await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`editor:${id}`]);
 if(!(await c.query('SELECT id FROM juyu.documents WHERE id=$1 FOR UPDATE',[id])).rowCount)throw new Error('NOT_FOUND');
 await c.query('SELECT clerk_user_id FROM juyu.members WHERE clerk_user_id=ANY($1::text[]) ORDER BY clerk_user_id FOR SHARE',[[actor.id]]);
 await requireCurrentAdmin(c,actor);
 const d=await loadDocument(c,id);if(!d)throw new Error('NOT_FOUND');if(d.lifecycle!=='active')throw new Error('INACTIVE_DOCUMENT');
 const w=d.workflow,last=d.audit.at(-1),receipt=await latestReceipt(c,id),valid=matchingApproval(d,receipt),status=input.action==='queue'?'queued':'published';
 const ack:PublicationAck={documentId:id,sequence:d.sequence,revision:w.revisionId,action:input.action,status,publishedRevision:d.publishedRevisionId,approvedBy:w.approvedBy!};
 // A retry acknowledges the already committed event, even if an asset changed
 // later. It never republishes, updates the timestamp, or adds another audit row.
 if(d.sequence===input.expectedSequence+1&&last?.sequence===d.sequence&&last.action===input.action&&last.actorId===actor.id
  &&last.revisionId===w.revisionId&&w.status===status&&valid)return ack;
 if(d.sequence!==input.expectedSequence)throw new Error('CONFLICT');
 if(w.status!==(input.action==='queue'?'approved':'queued'))throw new Error('INVALID_STATE');
 if(!valid)throw new Error('INVALID_APPROVAL');
 await requireReadyAssets(c,d);
 const now=new Date().toISOString(),command={type:input.action};
 const next=transition(d,command,actor,{expectedSequence:input.expectedSequence,now});
 await persistDocumentTransition(c,id,d,next,command,actor,now);
 return {...ack,sequence:next.sequence,publishedRevision:next.publishedRevisionId};
}
