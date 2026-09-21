import {normalizeCategoryIds} from '../../categories/model.ts';
import {readCategoryDefinitions} from '../categories/repository.ts';
import {normalizeFieldDefinitions,validateFieldSnapshots} from '../../fields/model.ts';
import {readFieldDefinitions} from '../fields/repository.ts';
import {normalizeQa} from '../../qa/metadata.ts';
import {isDeepStrictEqual} from 'node:util';
import {decodeEditorBody,encodeEditorBody,editorMedia} from '../../editor/document.ts';
import type {EditorData} from '../../editor/contract.ts';
import {blockAssetIds,type ManagedAsset} from '../../media/model.ts';
import {editorInput} from '../editor/input.ts';
import {COVER_MIME_TYPES} from '../../domain/presentation.ts';
import type { PoolClient } from 'pg';
import type { Transactions } from './scoped.ts';
import { canManage } from '../../domain/access.ts';
import type { AuditEntry, Document, Revision, Viewer } from '../../domain/model.ts';
import { createDocument, transition } from '../../domain/workflow.ts';
import type { Command, DraftInput } from '../../domain/workflow.ts';

function requireAdmin(viewer: Viewer | null): asserts viewer is Viewer {
  if (!canManage(viewer)) throw new Error('FORBIDDEN: 需要通过公司验证的管理员');
}

async function requireActiveMembers(client: PoolClient, ids: string[], lock = true) {
  const unique = [...new Set(ids)].sort();
  // FOR SHARE also blocks concurrent disabled_at updates until this transaction ends.
  const rows = await client.query<{ clerk_user_id: string; disabled_at: Date | null }>(
    `SELECT clerk_user_id, disabled_at FROM juyu.members WHERE clerk_user_id=ANY($1::text[]) ORDER BY clerk_user_id${lock ? ' FOR SHARE' : ''}`, [unique]);
  if (rows.rows.length !== unique.length || rows.rows.some((row) => row.disabled_at !== null)) {
    throw new Error('INACTIVE_MEMBER: 成员不存在或已经停用');
  }
}

// All calls use the same transaction snapshot (and writers first lock the document).
// Editor-only projection: retain current/published/max revision for edit numbering,
// and the last event for replay detection. Never use it for review/audit decisions.
// Full history remains immutable in storage and available through history endpoints.
async function load(client: PoolClient, id: string, scope: 'full' | 'editor' = 'full'): Promise<Document | null> {
  const result = await client.query('SELECT * FROM juyu.documents WHERE id=$1', [id]);
  const row = result.rows[0];
  if (!row) return null;
  const versions = await client.query(`SELECT coalesce((SELECT json_agg(rc.category_id ORDER BY rc.category_id) FROM juyu.revision_categories rc WHERE rc.document_id=r.document_id AND rc.revision_id=r.revision_id),'[]') AS "categoryIds",r.revision_id AS id,r.title,r.description,r.release_note AS "releaseNote",r.body,r.audience,r.tags,r.icon_key AS "iconKey",r.custom_fields AS "customFields",r.qa_category,r.qa_position,r.content_blocks AS blocks,
    CASE WHEN ra.asset_id IS NULL THEN NULL ELSE json_build_object('assetId',ra.asset_id,'alt',r.cover_alt,'position',r.cover_position) END AS cover,
    r.author_id AS "authorId",r.editor_id AS "editorId",r.created_at AS "createdAt"
    FROM juyu.revisions r LEFT JOIN juyu.revision_assets ra ON ra.document_id=r.document_id AND ra.revision_id=r.revision_id AND ra.usage='cover'
    WHERE r.document_id=$1 ${scope==='editor'?'AND r.revision_id IN ($2,$3,(SELECT max(revision_id) FROM juyu.revisions WHERE document_id=$1))':''} ORDER BY r.revision_id`, scope==='editor'?[id,row.workflow_revision_id,row.published_revision_id]:[id]);
  const history = await client.query('SELECT sequence,action,actor_id AS "actorId",revision_id AS "revisionId",at,reviewer_id AS "reviewerId",previous_reviewer_id AS "previousReviewerId",reason FROM juyu.audit_log WHERE document_id=$1 ORDER BY sequence'+(scope==='editor'?' DESC LIMIT 1':''), [id]);
  return {
    id: row.id, kind: row.kind, sequence: row.sequence, lifecycle: row.lifecycle,
    publishedRevisionId: row.published_revision_id,
    workflow: { revisionId: row.workflow_revision_id, status: row.workflow_state, submittedBy: row.submitted_by, reviewerId: row.reviewer_id, approvedBy: row.approved_by },
    revisions: versions.rows.map((revision) => (({qa_category,qa_position,iconKey,...rest})=>({...rest,...(iconKey?{iconKey}:{}),...(row.kind==='qa'?{qa:{category:qa_category,position:qa_position}}:{}),createdAt:rest.createdAt.toISOString()}))(revision)) as Revision[],
    audit: history.rows.map((entry) => ({ ...entry, at: entry.at.toISOString() })) as AuditEntry[],
  };
}

async function insertRevision(client: PoolClient, id: string, revision: Revision, previous: Revision | undefined = undefined) {
  await client.query('SELECT pg_advisory_xact_lock_shared(84620949)');
  await client.query('SELECT pg_advisory_xact_lock_shared(84620948)');
  const definitions=normalizeFieldDefinitions((await client.query(`SELECT v.config || jsonb_build_object('id',s.id,'version',s.current_version) AS definition FROM juyu.settings s JOIN juyu.setting_versions v ON v.setting_id=s.id AND v.version=s.current_version WHERE s.kind='field' ORDER BY s.id`)).rows.map(r=>r.definition));
  if((definitions.length||(revision.customFields?.length??0))&&!(await client.query('SELECT juyu.is_admin() AND juyu.actor_id()=$1 AND juyu.review_admin_eligible($1) AS ok',[revision.editorId])).rows[0]?.ok)throw new Error('FORBIDDEN');
  revision.customFields=validateFieldSnapshots(definitions,revision.customFields,previous?.customFields);
  const structured=decodeEditorBody(revision.body);
  if(structured!==null&&(encodeEditorBody(structured)!==revision.body||!isDeepStrictEqual(editorMedia(structured),revision.blocks??[])))throw new Error('INVALID_INPUT: 正文与媒体引用不一致');
  if(revision.cover){
    // Lock prevents quarantine/deletion while choosing this new draft's cover.
    const asset=await client.query('SELECT id FROM juyu.assets WHERE id=$1 AND document_id=$2 AND status=\'ready\' AND mime_type=ANY($3::text[]) FOR SHARE',[revision.cover.assetId,id,COVER_MIME_TYPES]);
    if(!asset.rowCount)throw new Error('INVALID_COVER: 请选择本篇文章已就绪的图片');
  }
  for(const block of revision.blocks??[]){
    for(const assetId of blockAssetIds(block)){
      const asset=(await client.query("SELECT mime_type FROM juyu.assets WHERE id=$1 AND document_id=$2 AND status='ready' FOR SHARE",[assetId,id])).rows[0];
      if(!asset||((block.type==='image'||!('assetId' in block))&&!COVER_MIME_TYPES.includes(asset.mime_type))||(block.type==='video'&&!['video/mp4','video/webm'].includes(asset.mime_type))||(block.type==='audio'&&!['audio/mpeg','audio/ogg'].includes(asset.mime_type)))throw new Error('INVALID_MEDIA: 文件不可用或不属于本篇文章');
    }
    if(block.type==='image'&&block.darkAssetId){const dark=(await client.query("SELECT mime_type FROM juyu.assets WHERE id=$1 AND document_id=$2 AND status='ready' FOR SHARE",[block.darkAssetId,id])).rows[0];if(!dark||!COVER_MIME_TYPES.includes(dark.mime_type))throw new Error('INVALID_MEDIA: 深色主题图片不可用或不属于本篇文章');}
  }
  await client.query(`INSERT INTO juyu.revisions(document_id,revision_id,title,body,audience,author_id,editor_id,created_at,tags,cover_alt,cover_position,content_blocks,qa_category,qa_position,custom_fields,category_ids,icon_key,description,release_note)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`, [id, revision.id, revision.title, revision.body, revision.audience, revision.authorId, revision.editorId, revision.createdAt,revision.tags??[],revision.cover?.alt??'',revision.cover?.position??50,JSON.stringify(revision.blocks??[]),revision.qa?.category??'',revision.qa?.position??0,JSON.stringify(revision.customFields),normalizeCategoryIds(revision.categoryIds),revision.iconKey??null,revision.description??'',revision.releaseNote??'']);
  for(const assetId of new Set((revision.blocks??[]).flatMap(blockAssetIds)))await client.query("INSERT INTO juyu.revision_assets(document_id,revision_id,asset_id,usage) VALUES($1,$2,$3,'inline')",[id,revision.id,assetId]);
  if(revision.cover)await client.query("INSERT INTO juyu.revision_assets(document_id,revision_id,asset_id,usage) VALUES($1,$2,$3,'cover')",[id,revision.id,revision.cover.assetId]);
}

async function insertAudit(client: PoolClient, id: string, entry: AuditEntry) {
  await client.query(`INSERT INTO juyu.audit_log(document_id,sequence,action,actor_id,revision_id,at,reviewer_id,previous_reviewer_id,reason)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [id, entry.sequence, entry.action, entry.actorId, entry.revisionId, entry.at, entry.reviewerId, entry.previousReviewerId, entry.reason]);
}

async function persistReview(client: PoolClient, next: Document, command: Command, actor: Viewer, now: string,englishQualityConfirmed=false) {
  const w = next.workflow;
  if (command.type === 'submit') {
    await client.query(`INSERT INTO juyu.reviews(document_id,submitted_sequence,revision_id,submitted_by,reviewer_id,status,submitted_at)
      VALUES ($1,$2,$3,$4,$5,'in_review',$6)`, [next.id, next.sequence, w.revisionId, w.submittedBy, w.reviewerId, now]);
  } else if (['reassign', 'approve', 'reject', 'withdraw'].includes(command.type)) {
    const result = command.type === 'reassign'
      ? await client.query("UPDATE juyu.reviews SET reviewer_id=$2 WHERE document_id=$1 AND status='in_review'", [next.id, w.reviewerId])
      : await client.query(`UPDATE juyu.reviews SET status=$2,decided_by=$3,decided_at=$4,reason=$5,english_quality_confirmed=$6
          WHERE document_id=$1 AND status='in_review'`, [next.id, { approve: 'approved', reject: 'rejected', withdraw: 'withdrawn' }[command.type as 'approve' | 'reject' | 'withdraw'], actor.id, now, command.type === 'reject' ? command.reason.trim() : null,command.type==='approve'&&englishQualityConfirmed]);
    if (result.rowCount !== 1) throw new Error('INTEGRITY: 缺少待审记录');
  }
}


async function persistNext(client:PoolClient,id:string,document:Document,next:Document,command:Command,actor:Viewer,now:string,englishQualityConfirmed=false){
      for (const revision of next.revisions.slice(document.revisions.length)) {
        await insertRevision(client, id, revision,document.revisions.find(r=>r.id===document.workflow.revisionId));
        await client.query(`INSERT INTO juyu.revision_assets(document_id,revision_id,asset_id,usage)
          SELECT document_id,$3,asset_id,usage FROM juyu.revision_assets WHERE document_id=$1 AND revision_id=$2 AND usage<>'cover' AND NOT (usage='inline' AND asset_id=ANY($4::uuid[])) ON CONFLICT DO NOTHING`,[id,document.workflow.revisionId,revision.id,(document.revisions.find(r=>r.id===document.workflow.revisionId)?.blocks??[]).flatMap(blockAssetIds)]);
      }
      await persistReview(client, next, command, actor, now, englishQualityConfirmed);
      const w = next.workflow;
      await client.query(`UPDATE juyu.documents SET sequence=$2,published_revision_id=$3,workflow_revision_id=$4,
        workflow_state=$5,submitted_by=$6,reviewer_id=$7,approved_by=$8,updated_at=$9 WHERE id=$1`,
        [id, next.sequence, next.publishedRevisionId, w.revisionId, w.status, w.submittedBy, w.reviewerId, w.approvedBy, now]);
      await insertAudit(client, id, next.audit[next.audit.length - 1]);
}

async function editorSnapshot(client:PoolClient,doc:Document):Promise<EditorData> {
 const revision=doc.revisions.find(r=>r.id===doc.workflow.revisionId)!;
 const assets=(await client.query<ManagedAsset>("SELECT id,filename,mime_type AS mime,byte_size::text AS size,status FROM juyu.assets WHERE document_id=$1 ORDER BY created_at DESC,id",[doc.id])).rows;
 const language=(await client.query<{locale:'zh-CN'|'en';translationOf:string|null}>('SELECT locale,translation_of AS "translationOf" FROM juyu.documents WHERE id=$1',[doc.id])).rows[0];
 const sibling=language.locale==='en'?
  (await client.query<{documentId:string;status:string;publishedRevision:number|null}>('SELECT id AS "documentId",workflow_state AS status,published_revision_id AS "publishedRevision" FROM juyu.documents WHERE id=$1',[language.translationOf])).rows[0]:
  (await client.query<{documentId:string;status:string;publishedRevision:number|null}>('SELECT id AS "documentId",workflow_state AS status,published_revision_id AS "publishedRevision" FROM juyu.documents WHERE translation_of=$1 AND locale=\'en\'',[doc.id])).rows[0];
 return {locale:language.locale,translationOf:language.translationOf,translation:sibling??null,publicationNumber:(await client.query('SELECT juyu.publication_number($1) AS n',[doc.id])).rows[0]?.n??null,categoryIds:revision.categoryIds??[],categoryOptions:await readCategoryDefinitions(client),customFields:revision.customFields??[],fieldDefinitions:await readFieldDefinitions(client),...(revision.qa?{qa:revision.qa}:{}),...(revision.iconKey?{iconKey:revision.iconKey}:{}),documentId:doc.id,title:revision.title,description:revision.description??'',releaseNote:revision.releaseNote??'',body:revision.body,sequence:doc.sequence,status:doc.workflow.status,lifecycle:doc.lifecycle,blocks:revision.blocks??[],cover:revision.cover??null,tags:revision.tags??[],assets,kind:doc.kind,audience:revision.audience,publishedRevision:doc.publishedRevisionId};
}
/** Server-only persistence boundary. Viewer must come from trusted server authentication,
 * never request JSON. All production transactions go through ScopedDatabase.
 * Real Clerk verification remains T012/T013.
 */
export class DocumentRepository {
  private readonly database: Transactions;
  constructor(database: Transactions) { this.database=database; }

  async getEditor(id:string,actor:Viewer|null):Promise<EditorData> {
    requireAdmin(actor);
    return this.database.run(actor,async client=>{
      await requireActiveMembers(client,[actor.id],false);
      const doc=await load(client,id,'editor');if(!doc)throw new Error('NOT_FOUND');
      return editorSnapshot(client,doc);
    },true);
  }

  async saveEditor(id:string,value:unknown,actor:Viewer|null):Promise<EditorData> {
    requireAdmin(actor);const input=editorInput(value);
    if(typeof id!=='string'||!id.trim()||id.length>200)throw new Error('INVALID_INPUT');
    if(input.expectedSequence===null&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id))throw new Error('INVALID_INPUT');
    const blocks=editorMedia(decodeEditorBody(input.body)!);
    return this.database.run(actor,async client=>{
      // Serializes duplicate creates before a document row exists. Existing writers
      // also synchronize on the document row below.
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`editor:${id}`]);
      await client.query('SELECT id FROM juyu.documents WHERE id=$1 FOR UPDATE',[id]);
      await requireActiveMembers(client,[actor.id]);
      const document=await load(client,id,'editor');const now=new Date().toISOString();
      if(!document){
        if(input.expectedSequence!==null)throw new Error('NOT_FOUND');
        if(input.locale==='en'){
          const source=(await client.query<{kind:string;locale:string;lifecycle:string}>('SELECT kind,locale,lifecycle FROM juyu.documents WHERE id=$1 FOR SHARE',[input.translationOf])).rows[0];
          if(!source||source.locale!=='zh-CN'||source.lifecycle!=='active'||source.kind!==input.kind)throw new Error('INVALID_TRANSLATION_SOURCE');
        }
        const created=createDocument({...input,id,blocks},actor,now);
        await client.query("INSERT INTO juyu.documents(id,kind,sequence,lifecycle,workflow_revision_id,workflow_state,locale,translation_of) VALUES($1,$2,0,'active',1,'draft',$3,$4)",[id,created.kind,input.locale??'zh-CN',input.translationOf??null]);
        await insertRevision(client,id,created.revisions[0]);await insertAudit(client,id,created.audit[0]);
        return editorSnapshot(client,created);
      }
      if(document.lifecycle!=='active')throw new Error('INACTIVE_DOCUMENT');
      const language=(await client.query<{locale:string;translationOf:string|null}>('SELECT locale,translation_of AS "translationOf" FROM juyu.documents WHERE id=$1',[id])).rows[0];
      if(language.locale!==(input.locale??'zh-CN')||language.translationOf!==(input.translationOf??null))throw new Error('INVALID_LOCALE');
      if(document.workflow.status==='in_review')throw new Error('INVALID_STATE');
      if(document.kind!==input.kind)throw new Error('INVALID_INPUT: 资料类型不可更改');
      const revision=document.revisions.find(r=>r.id===document.workflow.revisionId)!;
      const replaySequence=input.expectedSequence===null?0:input.expectedSequence+1;
      const last=document.audit.at(-1);
      const qa=normalizeQa(input.qa===undefined?revision.qa:input.qa);
      const identical=isDeepStrictEqual(revision.categoryIds??[],input.categoryIds===undefined?(revision.categoryIds??[]):input.categoryIds)&&isDeepStrictEqual(revision.customFields??[],input.customFields??[])&&isDeepStrictEqual(normalizeQa(revision.qa),qa)&&revision.title===input.title&&(revision.description??'')===input.description&&(revision.releaseNote??'')===input.releaseNote&&revision.body===input.body&&revision.audience===input.audience
        &&isDeepStrictEqual(revision.tags??[],input.tags)&&isDeepStrictEqual(revision.cover??null,input.cover)&&isDeepStrictEqual(revision.blocks??[],blocks)&&(revision.iconKey??null)===(input.iconKey===undefined?revision.iconKey??null:input.iconKey);
      if(document.sequence===replaySequence&&document.workflow.status==='draft'&&revision.editorId===actor.id&&last?.actorId===actor.id&&last.action===(input.expectedSequence===null?'create':'edit')&&identical)return editorSnapshot(client,document);
      if(input.expectedSequence===null||document.sequence!==input.expectedSequence)throw new Error('CONFLICT');
      const command:Command={type:'edit',...(input.categoryIds===undefined?{}:{categoryIds:input.categoryIds}),customFields:input.customFields??[],...(document.kind==='qa'?{qa}:{}),...(input.iconKey===undefined?{}:{iconKey:input.iconKey}),title:input.title,description:input.description,releaseNote:input.releaseNote,body:input.body,audience:input.audience,tags:input.tags,cover:input.cover,blocks};
      const next=transition(document,command,actor,{expectedSequence:input.expectedSequence,now});
      await persistNext(client,id,document,next,command,actor,now);
      return editorSnapshot(client,next);
    });
  }

  async getForManagement(id: string, actor: Viewer | null): Promise<Document | null> {
    requireAdmin(actor);
    return this.database.run(actor, async (client) => {
      await requireActiveMembers(client, [actor.id], false);
      return load(client, id);
    }, true);
  }

  async create(input: DraftInput, actor: Viewer | null): Promise<Document> {
    requireAdmin(actor);
    const document = createDocument(input, actor, new Date().toISOString());
    return this.database.run(actor, async (client) => {
      await requireActiveMembers(client, [actor.id]);
      await client.query(`INSERT INTO juyu.documents(id,kind,sequence,lifecycle,workflow_revision_id,workflow_state)
        VALUES ($1,$2,0,'active',1,'draft')`, [document.id, document.kind]);
      await insertRevision(client, document.id, document.revisions[0]);
      await insertAudit(client, document.id, document.audit[0]);
      return document;
    });
  }

  async execute(id: string, command: Command, actor: Viewer | null, context: { expectedSequence: number; reviewer?: Viewer }): Promise<Document> {
    requireAdmin(actor);
    return this.database.run(actor, async (client) => {
      const locked = await client.query('SELECT id FROM juyu.documents WHERE id=$1 FOR UPDATE', [id]);
      if (!locked.rowCount) throw new Error('NOT_FOUND: 资料不存在');
      const document = await load(client, id);
      if (!document) throw new Error('NOT_FOUND: 资料不存在');
      const now = new Date().toISOString();
      const next = transition(document, command, actor, { ...context, now });
      const memberIds = [actor.id];
      if ((command.type === 'submit' || command.type === 'reassign') && context.reviewer) memberIds.push(context.reviewer.id);
      await requireActiveMembers(client, memberIds);
      await persistNext(client,id,document,next,command,actor,now);
      return next;
    });
  }
}

// Shared transaction primitives for the authenticated submission boundary.
export {load as loadDocument,persistNext as persistDocumentTransition,editorSnapshot as readEditorSnapshot};
