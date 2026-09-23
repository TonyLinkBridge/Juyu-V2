import type {PoolClient} from 'pg';
import type {Viewer} from '../../domain/model.ts';
import type {AssetFile} from '../storage/contract.ts';
import {reviewId} from '../../review/model.ts';
import {historyInteger,restoreVersionInput,type HistoryEvent,type HistoryPage,type HistoryVersion,type VersionSummary,type RestoreVersionAck,type DeletedHistoryPage} from '../../history/model.ts';
async function requireCurrentAdmin(c:PoolClient,actor:Viewer){
 if(!(await c.query('SELECT juyu.is_admin() AND juyu.actor_id()=$1 AND juyu.review_admin_eligible($1) AS ok',[actor.id])).rows[0]?.ok)throw new Error('FORBIDDEN');
}
const pageSize=30;
const versionColumns=`r.revision_id AS revision,r.title,r.author_id AS "authorId",coalesce(author.display_name,r.author_id) AS "authorName",r.editor_id AS "editorId",coalesce(editor.display_name,r.editor_id) AS "editorName",r.created_at AS "createdAt"`;
const versionMembers=`LEFT JOIN juyu.members author ON author.clerk_user_id=r.author_id LEFT JOIN juyu.members editor ON editor.clerk_user_id=r.editor_id`;
type DatedVersion=Omit<VersionSummary,'createdAt'>&{createdAt:Date};
async function documentHeader(c:PoolClient,id:string){return (await c.query<Pick<HistoryPage,'documentId'|'title'|'sequence'|'revision'|'publishedRevision'|'lifecycle'|'status'>>(`SELECT d.id AS "documentId",r.title,d.sequence,d.workflow_revision_id AS revision,d.published_revision_id AS "publishedRevision",d.lifecycle,d.workflow_state AS status FROM juyu.documents d JOIN juyu.revisions r ON r.document_id=d.id AND r.revision_id=d.workflow_revision_id WHERE d.id=$1`,[id])).rows[0];}
export async function readHistory(c:PoolClient,id:string,actor:Viewer,eventPage=1,versionPage=1):Promise<HistoryPage>{
 reviewId(id);historyInteger(eventPage);historyInteger(versionPage);await requireCurrentAdmin(c,actor);
 const d=await documentHeader(c,id);
 // The receipt stores metadata only and survives content deletion. Normalize old
 // receipts in the read projection; never rewrite their immutable evidence.
 const receipt=d?null:(await c.query<{title:string;sequence:number;actor_id:string;deleted_at:Date}>('SELECT title,sequence,actor_id,deleted_at FROM juyu.deletion_receipts WHERE document_id=$1',[id])).rows[0];
 if(!d&&!receipt)throw new Error('NOT_FOUND');
 const source=d?`SELECT sequence,action,revision_id,actor_id,reviewer_id,previous_reviewer_id,reason,source_revision_id,previous_published_revision_id,at FROM juyu.audit_log WHERE document_id=$1`:`SELECT a.sequence,a.action,a.revision_id,a.actor_id,a.reviewer_id,a.previous_reviewer_id,a.reason,a.source_revision_id,a.previous_published_revision_id,a.at FROM juyu.deletion_receipts r CROSS JOIN LATERAL jsonb_to_recordset(r.audit) AS a(sequence integer,action text,revision_id integer,actor_id text,reviewer_id text,previous_reviewer_id text,reason text,source_revision_id integer,previous_published_revision_id integer,at timestamptz) WHERE r.document_id=$1 UNION ALL SELECT r.sequence,'purge',NULL::integer,r.actor_id,NULL::text,NULL::text,NULL::text,NULL::integer,NULL::integer,r.deleted_at FROM juyu.deletion_receipts r WHERE r.document_id=$1 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r.audit) a WHERE a->>'action'='purge')`;
 const eventTotal=(await c.query<{n:number}>(`SELECT count(*)::int AS n FROM (${source}) events`,[id])).rows[0].n;
 const versionTotal=d?(await c.query<{n:number}>('SELECT count(*)::int AS n FROM juyu.revisions WHERE document_id=$1',[id])).rows[0].n:0;
 const eventPages=Math.max(1,Math.ceil(eventTotal/pageSize)),versionPages=Math.max(1,Math.ceil(versionTotal/pageSize));eventPage=Math.min(eventPage,eventPages);versionPage=Math.min(versionPage,versionPages);
 const events=(await c.query<Omit<HistoryEvent,'at'>&{at:Date}>(`WITH events AS (${source}) SELECT e.sequence,e.action,e.revision_id AS revision,e.actor_id AS "actorId",coalesce(actor.display_name,e.actor_id) AS "actorName",CASE WHEN e.action='direct_publish' THEN NULL ELSE e.reviewer_id END AS "reviewerId",CASE WHEN e.action='direct_publish' THEN NULL ELSE reviewer.display_name END AS "reviewerName",CASE WHEN e.action='direct_publish' THEN NULL ELSE e.previous_reviewer_id END AS "previousReviewerId",CASE WHEN e.action='direct_publish' THEN NULL ELSE previous.display_name END AS "previousReviewerName",CASE WHEN e.action='direct_publish' THEN NULL ELSE e.reason END AS reason,e.source_revision_id AS "sourceRevision",e.previous_published_revision_id AS "previousPublishedRevision",e.at FROM events e LEFT JOIN juyu.members actor ON actor.clerk_user_id=e.actor_id LEFT JOIN juyu.members reviewer ON reviewer.clerk_user_id=e.reviewer_id LEFT JOIN juyu.members previous ON previous.clerk_user_id=e.previous_reviewer_id ORDER BY e.sequence DESC LIMIT 30 OFFSET $2`,[id,(eventPage-1)*pageSize])).rows.map(e=>({...e,at:e.at.toISOString()}));
 const versions=d?(await c.query<DatedVersion>(`SELECT ${versionColumns} FROM juyu.revisions r ${versionMembers} WHERE r.document_id=$1 ORDER BY r.revision_id DESC LIMIT 30 OFFSET $2`,[id,(versionPage-1)*pageSize])).rows.map(v=>({...v,createdAt:v.createdAt.toISOString()})):[];
 return {...(d??{documentId:id,title:receipt!.title,sequence:receipt!.sequence,revision:null,publishedRevision:null,lifecycle:'purged' as const,status:null}),events,eventPage,eventPages,eventTotal,versions,versionPage,versionPages,versionTotal};
}
export async function readHistoryVersion(c:PoolClient,id:string,revision:number,actor:Viewer):Promise<HistoryVersion>{
 reviewId(id);historyInteger(revision);await requireCurrentAdmin(c,actor);const d=await documentHeader(c,id);if(!d)throw new Error('NOT_FOUND');
 const v=(await c.query<Omit<HistoryVersion['version'],'createdAt'>&{createdAt:Date;qa_category:string;qa_position:number;kind:string}>(`SELECT ${versionColumns},r.description,r.release_note AS "releaseNote",r.body,r.audience,r.tags,r.custom_fields AS "customFields",r.qa_category,r.qa_position,(SELECT kind FROM juyu.documents WHERE id=r.document_id) AS kind,r.content_blocks AS blocks,CASE WHEN cover.asset_id IS NULL THEN NULL ELSE json_build_object('assetId',cover.asset_id,'alt',r.cover_alt,'position',r.cover_position) END AS cover FROM juyu.revisions r ${versionMembers} LEFT JOIN juyu.revision_assets cover ON cover.document_id=r.document_id AND cover.revision_id=r.revision_id AND cover.usage='cover' WHERE r.document_id=$1 AND r.revision_id=$2`,[id,revision])).rows[0];if(!v)throw new Error('NOT_FOUND');
 const categories=(await c.query<{id:string;name:string}>(`SELECT c.id,c.name FROM juyu.revision_categories rc JOIN juyu.categories c ON c.id=rc.category_id WHERE rc.document_id=$1 AND rc.revision_id=$2 ORDER BY c.position,c.id`,[id,revision])).rows;
 const assets=(await c.query<HistoryVersion['assets'][number]>(`SELECT DISTINCT a.id,a.filename,a.mime_type AS mime,a.byte_size::text AS size,a.status FROM juyu.assets a JOIN juyu.revision_assets ra ON ra.asset_id=a.id AND ra.document_id=a.document_id WHERE ra.document_id=$1 AND ra.revision_id=$2 ORDER BY a.id`,[id,revision])).rows;
 const filesAvailable=(await c.query<{ok:boolean}>(`SELECT
 NOT EXISTS(SELECT 1 FROM juyu.assets a WHERE a.document_id=$1 AND a.status='pending')
 AND NOT EXISTS(SELECT 1 FROM juyu.revision_assets ra LEFT JOIN juyu.assets a ON a.id=ra.asset_id AND a.document_id=ra.document_id WHERE ra.document_id=$1 AND ra.revision_id=$2 AND (a.id IS NULL OR a.status<>'ready'))
 AND NOT EXISTS(SELECT 1 FROM juyu.revisions r CROSS JOIN LATERAL jsonb_array_elements(r.content_blocks) block WHERE r.document_id=$1 AND r.revision_id=$2 AND block ? 'assetId' AND NOT EXISTS(SELECT 1 FROM juyu.revision_assets ra JOIN juyu.assets a ON a.id=ra.asset_id AND a.document_id=ra.document_id WHERE ra.document_id=$1 AND ra.revision_id=$2 AND ra.asset_id::text=block->>'assetId' AND a.status='ready'))
 AND (SELECT max(revision_id) FROM juyu.revisions WHERE document_id=$1)=$3 AS ok`,[id,revision,d.revision])).rows[0].ok;
 return {documentId:id,sequence:d.sequence,currentRevision:d.revision!,publishedRevision:d.publishedRevision,lifecycle:d.lifecycle as HistoryVersion['lifecycle'],status:d.status!,version:(({qa_category,qa_position,kind,...rest})=>({...rest,...(kind==='qa'?{qa:{category:qa_category,position:qa_position}}:{}),createdAt:rest.createdAt.toISOString()}))(v),categories,assets,canRestore:filesAvailable&&d.lifecycle==='active'&&d.status!=='in_review'&&revision<d.revision!};
}
export async function restoreSavedVersion(c:PoolClient,id:string,input:unknown,actor:Viewer):Promise<RestoreVersionAck>{
 reviewId(id);const x=restoreVersionInput(input);await requireCurrentAdmin(c,actor);
 return (await c.query<RestoreVersionAck>('SELECT document_id AS "documentId",sequence,revision,source_revision AS "sourceRevision",status,published_revision AS "publishedRevision" FROM juyu.restore_document_version($1,$2,$3)',[id,x.sourceRevision,x.expectedSequence])).rows[0];
}
export async function readHistoryAsset(c:PoolClient,id:string,revision:number,assetId:string,actor:Viewer):Promise<AssetFile|null>{
 reviewId(id);historyInteger(revision);await requireCurrentAdmin(c,actor);if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assetId))throw new Error('INVALID_INPUT');
 return (await c.query<AssetFile>(`SELECT a.id,a.document_id,a.filename,a.mime_type,a.byte_size,a.bucket,a.object_key FROM juyu.assets a JOIN juyu.documents d ON d.id=a.document_id WHERE a.document_id=$1 AND a.id=$3 AND a.status='ready' AND EXISTS(SELECT 1 FROM juyu.revision_assets ra WHERE ra.document_id=$1 AND ra.revision_id=$2 AND ra.asset_id=a.id)`,[id,revision,assetId])).rows[0]??null;
}

export async function readDeletedHistory(c:PoolClient,actor:Viewer,page=1):Promise<DeletedHistoryPage>{
 historyInteger(page);await requireCurrentAdmin(c,actor);
 const total=(await c.query<{n:number}>('SELECT count(*)::int AS n FROM juyu.deletion_receipts')).rows[0].n;
 const pages=Math.max(1,Math.ceil(total/pageSize));page=Math.min(page,pages);
 const items=(await c.query<Omit<DeletedHistoryPage['items'][number],'deletedAt'>&{deletedAt:Date}>(`SELECT r.document_id AS "documentId",r.title,r.sequence,r.actor_id AS "actorId",coalesce(m.display_name,r.actor_id) AS "actorName",r.deleted_at AS "deletedAt" FROM juyu.deletion_receipts r LEFT JOIN juyu.members m ON m.clerk_user_id=r.actor_id ORDER BY r.deleted_at DESC,r.document_id COLLATE "C" LIMIT 30 OFFSET $1`,[(page-1)*pageSize])).rows.map(r=>({...r,deletedAt:r.deletedAt.toISOString()}));
 return {items,total,page,pages};
}
