import {readAnnouncements,writeAnnouncement,recordReceipt as recordAnnouncementReceipt} from '../announcements/repository.ts';
import {readHistory as readSettingHistory,readHistoryDetail,restoreSetting} from '../setting-history/repository.ts';
import {readFeatureConfig,writeFeatureConfig,readFeatureFlags,requireFeature} from '../features/repository.ts';
import {readNavigationSettings,writeNavigationSettings,readReaderMenu} from '../navigation-settings/repository.ts';
import {readForms,readForm,writeForm,submitForm,readFormRecords,readFormRecord,processFormRecord} from '../forms/repository.ts';
import {readCategoryDefinitions,writeCategoryDefinition} from '../categories/repository.ts';
import {normalizeFieldSnapshots} from '../../fields/model.ts';
import type {FieldSnapshot} from '../../fields/model.ts';
import {readFieldDefinitions,writeFieldDefinition} from '../fields/repository.ts';
import {readAnalyticsDashboard} from '../analytics/dashboard.ts';
import {captureAnalytics} from '../analytics/repository.ts';
import {readRecent,recordRecent} from '../recent/repository.ts';
import {readFavorites,readFavorite,writeFavorite} from '../favorites/repository.ts';
import {readQa} from '../qa/repository.ts';
import {readReference,readReferenceDetail} from '../reference/repository.ts';
import {readOps,readReaderSections} from '../ops/repository.ts';
import {readHistory,readHistoryVersion,restoreSavedVersion,readHistoryAsset,readDeletedHistory} from '../history/repository.ts';
import {readAvailabilityDetail,changeSavedAvailability,readArchives} from '../availability/repository.ts';
import {readPublicationDetail,changeSavedPublication} from '../review/publication.ts';
import {readControlDetail,changeSavedReviewControl} from '../review/control.ts';
import {readReviewDetail,decideSavedReview} from '../review/decision.ts';
import {readReviewers,submitSavedReview} from '../review/repository.ts';
import {readTrash,changeLifecycle,cleanupJobs,startCleanupAttempt,cleanupPending,finishCleanup} from '../lifecycle/repository.ts';
import type {EditorData} from '../../editor/contract.ts';
import {decodeEditorBody} from '../../editor/document.ts';
import {readWorkspace} from '../workspace/repository.ts';
import type {QueryInput} from '../../workspace/model.ts';
import {normalizeBlocks,uploadMetadata,type ManagedAsset} from '../../media/model.ts';
import type {MediaEditorData} from '../../media/editor.ts';
import {positiveInteger} from '../../feedback/model.ts';
import type {PDFSnapshot} from '../../pdf/model.ts';
import {readFeedback,writeFeedback,feedbackOverview,feedbackDetails} from '../feedback/repository.ts';
import type {ArticlePresentation} from '../../domain/presentation.ts';
import type {TitleSearch} from '../../reader/search.ts';
import {searchPublications} from '../search/repository.ts';
import type {PoolClient} from 'pg';
import type {Publication} from '../../reader/body.ts';
import {selectTreePage} from '../../reader/tree.ts';
import {buildNavigationTree,type NavigationNode,type NavigationCategory,type NavigationMembership} from '../../reader/tree.ts';
import { navigationPage, type NavigationPage } from '../../reader/navigation.ts';
import type { AssetFile } from '../storage/contract.ts';
import { canManage, parseRole } from '../../domain/access.ts';
import type { Viewer } from '../../domain/model.ts';
import type { Transactions } from '../database/scoped.ts';
import { DocumentRepository } from '../database/repository.ts';

// The adapter obtains identity from the server's verified session, never request headers/body.
export type Authenticate = () => Promise<Viewer|null>;
export class AuthorizationService {
  private database:Transactions;
  private authenticate:Authenticate;
  constructor(database:Transactions,authenticate:Authenticate){this.database=database;this.authenticate=authenticate;}
  private async viewer(admin=false) {
    const viewer=await this.authenticate();
    if(!viewer || typeof viewer.id!=='string' || !viewer.id.trim() || viewer.companyVerified!==true || !parseRole(viewer.role) || (admin&&!canManage(viewer))) throw new Error('FORBIDDEN: 没有访问权限');
    return viewer;
  }
  async announcements(admin=false){const v=await this.viewer(admin);return this.database.run(v,c=>readAnnouncements(c,admin),true);}
  async saveAnnouncement(id:string,input:unknown){const v=await this.viewer(true);return this.database.run(v,c=>writeAnnouncement(c,id,input));}
  async announcementReceipt(id:string,input:unknown){const v=await this.viewer();return this.database.run(v,c=>recordAnnouncementReceipt(c,id,input));}
  async settingHistory(kind='all',page=1){const v=await this.viewer(true);return this.database.run(v,c=>readSettingHistory(c,{kind,page}),true);}
  async settingHistoryDetail(input:unknown){const v=await this.viewer(true);return this.database.run(v,c=>readHistoryDetail(c,input),true);}
  async restoreSetting(input:unknown){const v=await this.viewer(true);return this.database.run(v,c=>restoreSetting(c,input));}
  async features(){const v=await this.viewer();return this.database.run(v,c=>readFeatureFlags(c),true);}
  async home(){
    const v=await this.viewer();
    return this.database.run(v,async c=>{
      const features=await readFeatureFlags(c);
      const pages=await readNavigationTree(c);
      const menu=await readReaderMenu(c);
      const rows=(await c.query<{id:string;title:string;updated:Date}>(`SELECT document_id AS id,title,created_at AS updated FROM juyu.revisions WHERE juyu.can_read_revision(document_id,revision_id) ORDER BY created_at DESC,document_id COLLATE "C" LIMIT 5`)).rows;
      const recent=features.recent?(await readRecent(c)).items.slice(0,4):[];
      return {features,pages,menu,latest:rows.map(r=>({...r,updated:r.updated.toISOString()})),recent};
    },true);
  }
  async featureConfig(){const v=await this.viewer(true);return this.database.run(v,c=>readFeatureConfig(c),true);}
  async saveFeatureConfig(input:unknown){const v=await this.viewer(true);return this.database.run(v,c=>writeFeatureConfig(c,input));}
  async navigationSettings(){const v=await this.viewer(true);return this.database.run(v,c=>readNavigationSettings(c),true);}
  async saveNavigationSettings(input:unknown){const v=await this.viewer(true);return this.database.run(v,c=>writeNavigationSettings(c,input));}
  async readerChrome(){const v=await this.viewer();return this.database.run(v,async c=>({items:await readReaderMenu(c),features:await readFeatureFlags(c)}),true);}
  async readerMenu(){const v=await this.viewer();return this.database.run(v,c=>readReaderMenu(c),true);}
  async requireFormMember(){await this.viewer();}
  async forms(admin=false){const v=await this.viewer(admin);return this.database.run(v,c=>readForms(c,admin),true);}
  async form(id:string,admin=false){const v=await this.viewer(admin);return this.database.run(v,c=>readForm(c,id,admin),true);}
  async saveForm(id:string,input:unknown){const v=await this.viewer(true);return this.database.run(v,c=>writeForm(c,id,input));}
  async submitForm(id:string,input:unknown){const v=await this.viewer();return this.database.run(v,c=>submitForm(c,id,input));}
  async formRecords(page=1){const v=await this.viewer(true);return this.database.run(v,c=>readFormRecords(c,page),true);}
  async formRecord(id:string){const v=await this.viewer(true);return this.database.run(v,c=>readFormRecord(c,id),true);}
  async processFormRecord(id:string,input:unknown){const v=await this.viewer(true);return this.database.run(v,c=>processFormRecord(c,id,input));}
  async categories(){const v=await this.viewer(true);return this.database.run(v,c=>readCategoryDefinitions(c),true);}
  async saveCategory(id:string,input:unknown){const v=await this.viewer(true);return this.database.run(v,c=>writeCategoryDefinition(c,id,input));}
  async fields(){const v=await this.viewer(true);return this.database.run(v,c=>readFieldDefinitions(c),true);}
  async saveField(id:string,input:unknown){const v=await this.viewer(true);return this.database.run(v,c=>writeFieldDefinition(c,id,input));}
  async analyticsDashboard(days:unknown=30){const v=await this.viewer(true);return this.database.run(v,c=>readAnalyticsDashboard(c,days),true);}
  async captureAnalytics(input:unknown){const v=await this.viewer();return this.database.run(v,c=>captureAnalytics(c,input));}
  async recent(page=1){const v=await this.viewer();return this.database.run(v,c=>readRecent(c,page),true);}
  async recordRecent(id:string,input:unknown){const v=await this.viewer();return this.database.run(v,c=>recordRecent(c,id,input));}
  async favorites(page=1){const v=await this.viewer();return this.database.run(v,c=>readFavorites(c,page),true);}
  async favorite(id:string,revision:number){const v=await this.viewer();return this.database.run(v,c=>readFavorite(c,id,revision),true);}
  async saveFavorite(id:string,input:unknown){const v=await this.viewer();return this.database.run(v,c=>writeFavorite(c,id,input));}
  async qa(page=1,category?:string){const v=await this.viewer();return this.database.run(v,c=>readQa(c,page,category),true);}
  async reference(page=1){const v=await this.viewer();return this.database.run(v,c=>readReference(c,page),true);}
  async referenceDetail(id:string){const v=await this.viewer();return this.database.run(v,c=>readReferenceDetail(c,id),true);}
  async readerSections(){const v=await this.viewer();return this.database.run(v,c=>readReaderSections(c),true);}
  async ops(page=1){const v=await this.viewer();return this.database.run(v,c=>readOps(c,page),true);}
  async deletedHistory(page=1){const v=await this.viewer(true);return this.database.run(v,c=>readDeletedHistory(c,v,page),true);}
  async history(id:string,eventPage=1,versionPage=1){const v=await this.viewer(true);return this.database.run(v,c=>readHistory(c,id,v,eventPage,versionPage),true);}
  async historyVersion(id:string,revision:number){const v=await this.viewer(true);return this.database.run(v,c=>readHistoryVersion(c,id,revision,v),true);}
  async restoreVersion(id:string,input:unknown){const v=await this.viewer(true);return this.database.run(v,c=>restoreSavedVersion(c,id,input,v));}
  async historyAsset(id:string,revision:number,assetId:string){const v=await this.viewer(true);return this.database.run(v,c=>readHistoryAsset(c,id,revision,assetId,v),true);}
  async availabilityDetail(id:string){const v=await this.viewer(true);return this.database.run(v,c=>readAvailabilityDetail(c,id,v),true);}
  async changeAvailability(id:string,input:unknown){const v=await this.viewer(true);return this.database.run(v,c=>changeSavedAvailability(c,id,input,v));}
  async archives(page=1){const v=await this.viewer(true);return this.database.run(v,c=>readArchives(c,v,page),true);}
  async publicationDetail(id:string){const v=await this.viewer(true);return this.database.run(v,c=>readPublicationDetail(c,id,v),true);}
  async changePublication(id:string,input:unknown){const v=await this.viewer(true);return this.database.run(v,c=>changeSavedPublication(c,id,input,v));}
  async controlReviewDetail(id:string,after=''){const v=await this.viewer(true);return this.database.run(v,c=>readControlDetail(c,id,v,after),true);}
  async changeReviewControl(id:string,input:unknown){const v=await this.viewer(true);return this.database.run(v,c=>changeSavedReviewControl(c,id,input,v));}
  async reviewDetail(id:string){const v=await this.viewer(true);return this.database.run(v,c=>readReviewDetail(c,id,v),true);}
  async decideReview(id:string,input:unknown){const v=await this.viewer(true);return this.database.run(v,c=>decideSavedReview(c,id,input,v));}
  async reviewers(id:string,after=''){const v=await this.viewer(true);return this.database.run(v,c=>readReviewers(c,id,v,after),true);}
  async submitReview(id:string,input:unknown){const v=await this.viewer(true);return this.database.run(v,c=>submitSavedReview(c,id,input,v));}
  async trash(page=1,cleanupPage=1){const v=await this.viewer(true);return this.database.run(v,c=>readTrash(c,page,cleanupPage),true);}
  async lifecycle(id:string,input:unknown){const v=await this.viewer(true);return this.database.run(v,c=>changeLifecycle(c,id,input));}
  async cleanupJobs(id:string){const v=await this.viewer(true);return this.database.run(v,c=>cleanupJobs(c,id),true);}
  async startCleanupAttempt(id:string,key:string){const v=await this.viewer(true);return this.database.run(v,c=>startCleanupAttempt(c,id,key));}
  async cleanupPending(id:string){const v=await this.viewer(true);return this.database.run(v,c=>cleanupPending(c,id),true);}
  async finishCleanup(id:string,key:string){const v=await this.viewer(true);return this.database.run(v,c=>finishCleanup(c,id,key));}
  async navigation():Promise<NavigationPage[]> {
    const viewer=await this.viewer();
    return this.database.run(viewer,async client=>{
      // Admin also sees only the current publication in the employee reader.
      // Documents are intentionally not directly SELECT-able by ordinary readers.
      const result=await client.query<{id:string;title:string}>(
        'SELECT document_id AS id,title FROM juyu.revisions WHERE juyu.can_read_revision(document_id,revision_id) ORDER BY title COLLATE "C",document_id COLLATE "C"');
      return result.rows.map(navigationPage);
    },true);
  }
  async categoryNavigationTree():Promise<NavigationNode[]> {
    const viewer=await this.viewer();
    return this.database.run(viewer,async client=>{
      const allowed=(await client.query(`SELECT EXISTS(SELECT 1 FROM juyu.current_identity() i JOIN juyu.members m ON m.clerk_user_id=i.member_id WHERE nullif(btrim(m.verified_email),'') IS NOT NULL AND m.observed_at IS NOT NULL) AS allowed`)).rows[0].allowed;
      if(!allowed)throw new Error('FORBIDDEN');
      return readNavigationTree(client,true);
    },true);
  }
  async navigationTree():Promise<NavigationNode[]> {
    const viewer=await this.viewer();
    return this.database.run(viewer,async client=>{
      return readNavigationTree(client);
    },true);
  }
  async reader(requested:string|string[]|undefined):Promise<{pages:NavigationNode[];article:Publication|null}> {
    const viewer=await this.viewer();
    return this.database.run(viewer,async client=>{
      const pages=await readNavigationTree(client);
      const selected=selectTreePage(pages,requested);
      if(!selected)return {pages,article:null};
      const result=await client.query<{document_id:string;title:string;revision_id:number;body:string}>(
        'SELECT document_id,title,revision_id,body FROM juyu.read_publication($1)',[selected.id]);
      const row=result.rows[0];
      return {pages,article:row?{id:row.document_id,title:row.title,revision:row.revision_id,body:row.body,...await readPresentation(client,selected.id)}:null};
    },true);
  }
  async search(query:string|string[]|undefined,page?:string|string[]):Promise<{pages:NavigationNode[];search:TitleSearch}> {
    const viewer=await this.viewer();
    return this.database.run(viewer,async client=>{
      const pages=await readNavigationTree(client);
      return {pages,search:await searchPublications(client,pages,query,page)};
    },true);
  }
  async article(id:string) {
    const viewer=await this.viewer();
    return this.database.run(viewer,async client=>{const row=(await client.query('SELECT * FROM juyu.read_publication($1)',[id])).rows[0];return row?{...row,...await readPresentation(client,id)}:null;},true);
  }
  async pdf(id:string,revision:number):Promise<PDFSnapshot> {
    positiveInteger(revision);const viewer=await this.viewer();
    return this.database.run(viewer,async client=>{
      await requireFeature(client,'pdfExport');
      const row=(await client.query('SELECT document_id,title,revision_id,body FROM juyu.read_publication($1)',[id])).rows[0];
      if(!row)throw new Error('NOT_FOUND');if(row.revision_id!==revision)throw new Error('VERSION_CHANGED');
      const files=(await client.query(`SELECT a.id,a.filename,a.byte_size::text AS size FROM juyu.assets a JOIN juyu.revision_assets ra ON ra.asset_id=a.id AND ra.document_id=a.document_id WHERE ra.document_id=$1 AND ra.revision_id=$2 AND a.mime_type='application/pdf' AND juyu.can_read_asset(a.id) ORDER BY a.filename COLLATE "C",a.id`,[id,revision])).rows;
      return {article:{id:row.document_id,title:row.title,revision:row.revision_id,body:row.body,...await readPresentation(client,id)},files};
    },true);
  }
  async feedback(id:string,revision:number){const v=await this.viewer();return this.database.run(v,c=>readFeedback(c,id,revision),true);}
  async saveFeedback(id:string,input:unknown){const v=await this.viewer();return this.database.run(v,c=>writeFeedback(c,id,input));}
  async feedbackOverview(page:unknown=1){const v=await this.viewer(true);return this.database.run(v,c=>feedbackOverview(c,page),true);}
  async feedbackDetails(id:string,revision:number,page:unknown=1){const v=await this.viewer(true);return this.database.run(v,c=>feedbackDetails(c,id,revision,page),true);}
  async workspace(input:QueryInput={}){const v=await this.viewer(true);return this.database.run(v,c=>readWorkspace(c,v.id,input),true);}
  async mediaDocuments(page=1){
    const viewer=await this.viewer(true);positiveInteger(page);
    return this.database.run(viewer,async c=>{
      const total=(await c.query("SELECT count(*)::int AS n FROM juyu.documents WHERE lifecycle='active'")).rows[0].n as number;
      const pages=Math.max(1,Math.ceil(total/30));page=Math.min(page,pages);
      const items=(await c.query(`SELECT d.id,r.title,d.workflow_state AS status FROM juyu.documents d JOIN juyu.revisions r ON r.document_id=d.id AND r.revision_id=d.workflow_revision_id WHERE d.lifecycle='active' ORDER BY d.updated_at DESC,d.id COLLATE "C" LIMIT 30 OFFSET $1`,[(page-1)*30])).rows;
      return {items,total,page,pages};
    },true);
  }
  async requireEditorAdmin(){await this.viewer(true);}
  async editor(id:string):Promise<EditorData>{return new DocumentRepository(this.database).getEditor(id,await this.viewer(true));}
  async saveDraft(id:string,input:unknown):Promise<EditorData>{return new DocumentRepository(this.database).saveEditor(id,input,await this.viewer(true));}
  async media(id:string):Promise<MediaEditorData>{
    const viewer=await this.viewer(true);const doc=await new DocumentRepository(this.database).getForManagement(id,viewer);if(!doc)throw new Error('NOT_FOUND');
    const revision=doc.revisions.find(r=>r.id===doc.workflow.revisionId)!;
    const assets=await this.database.run(viewer,async c=>(await c.query<ManagedAsset>("SELECT id,filename,mime_type AS mime,byte_size::text AS size,status FROM juyu.assets WHERE document_id=$1 ORDER BY created_at DESC,id",[id])).rows,true);
    return {documentId:id,title:revision.title,body:revision.body,sequence:doc.sequence,status:doc.workflow.status,lifecycle:doc.lifecycle,blocks:revision.blocks??[],cover:revision.cover??null,tags:revision.tags??[],assets};
  }
  async saveMedia(id:string,input:unknown){
    const v=await this.viewer(true);
    if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('INVALID_INPUT');const x=input as Record<string,unknown>;
    if(Object.keys(x).some(k=>!['expectedSequence','blocks','cover'].includes(k))||!Number.isSafeInteger(x.expectedSequence)||Number(x.expectedSequence)<0)throw new Error('INVALID_INPUT');
    if(!Object.hasOwn(x,'blocks'))throw new Error('INVALID_INPUT');const blocks=normalizeBlocks(x.blocks);const repo=new DocumentRepository(this.database);const doc=await repo.getForManagement(id,v);if(!doc)throw new Error('NOT_FOUND');const revision=doc.revisions.find(r=>r.id===doc.workflow.revisionId)!;
    if(decodeEditorBody(revision.body)!==null)throw new Error('USE_EDITOR');
    await repo.execute(id,{type:'edit',title:revision.title,body:revision.body,audience:revision.audience,blocks,...(Object.hasOwn(x,'cover')?{cover:x.cover as typeof revision.cover}:{})},v,{expectedSequence:Number(x.expectedSequence)});
    return this.media(id);
  }
  async reserveUpload(id:string,assetId:string,metadata:ReturnType<typeof uploadMetadata>){const v=await this.viewer(true);await this.database.run(v,c=>c.query('SELECT juyu.reserve_upload($1,$2,$3,$4,$5)',[assetId,id,metadata.filename,metadata.mime,metadata.size]));}
  async finishUpload(assetId:string,ready:boolean){const v=await this.viewer(true);await this.database.run(v,c=>c.query('SELECT juyu.finish_upload($1,$2)',[assetId,ready]));}
  async managementAsset(id:string):Promise<AssetFile|null>{const v=await this.viewer(true);return this.database.run(v,async c=>(await c.query("SELECT a.* FROM juyu.assets a JOIN juyu.documents d ON d.id=a.document_id WHERE a.id=$1 AND a.status='ready' AND d.lifecycle='active'",[id])).rows[0]??null,true);}
  async management(id:string){ return new DocumentRepository(this.database).getForManagement(id,await this.viewer(true)); }
  async asset(id:string): Promise<AssetFile | null> {
    const viewer=await this.viewer();
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return null;
    return this.database.run(viewer,async client=>(await client.query('SELECT id,document_id,filename,mime_type,byte_size,bucket,object_key FROM juyu.assets WHERE id=$1 AND juyu.can_read_asset(id)',[id])).rows[0]??null,true);
  }
}

// Fail closed until T012/T013 bind a real Clerk + company verification adapter.
export const unavailableAuthentication:Authenticate=async()=>{throw new Error('AUTH_NOT_CONFIGURED');};
export async function protectedResponse(action:()=>Promise<unknown>):Promise<Response> {
  const headers={'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'};
  try {const data=await action();return Response.json(data??{error:'NOT_FOUND'},{status:data==null?404:200,headers});}
  catch(error){
    const message=error instanceof Error?error.message:'';
    const unavailable=['MEMBER_BUSY','MEMBER_PENDING','SERVICE_UNAVAILABLE'].includes(message);
    const status=message==='AUTH_NOT_CONFIGURED'||unavailable?503:(message.startsWith('FORBIDDEN')||message==='FEATURE_DISABLED')?403:500;
    return Response.json({error:status===503?(unavailable?'SERVICE_UNAVAILABLE':'AUTH_NOT_CONFIGURED'):status===403?(message==='FEATURE_DISABLED'?'FEATURE_DISABLED':'FORBIDDEN'):'INTERNAL_ERROR'},{status,headers});
  }
}

async function readNavigationTree(client:PoolClient,repeatMemberships=false):Promise<NavigationNode[]> {
      const pages=await client.query<{id:string;title:string}>(
        'SELECT document_id AS id,title FROM juyu.revisions WHERE juyu.can_read_revision(document_id,revision_id)');
      const memberships=await client.query<NavigationMembership>(
        'SELECT document_id,category_id FROM juyu.revision_categories WHERE juyu.can_read_revision(document_id,revision_id)');
      const categories=await client.query<NavigationCategory>(
        'SELECT id,name,parent_id,position FROM juyu.categories WHERE juyu.category_allowed(id)');
      return buildNavigationTree(pages.rows,categories.rows,memberships.rows,{repeatMemberships});
}

async function readPresentation(client:PoolClient,id:string):Promise<ArticlePresentation&{customFields?:FieldSnapshot[]}> {
 const row=(await client.query<{tags:string[];cover_asset_id:string|null;cover_alt:string;cover_position:number}>('SELECT * FROM juyu.read_publication_presentation($1)',[id])).rows[0];
 if(!row)return {};
 const blocks=(await client.query('SELECT juyu.read_publication_blocks($1) AS blocks',[id])).rows[0]?.blocks;
 const customFields=normalizeFieldSnapshots((await client.query('SELECT juyu.read_publication_fields($1) AS fields',[id])).rows[0]?.fields);
 return {...(customFields.length?{customFields}:{}),...(blocks?.length?{blocks:normalizeBlocks(blocks)}:{}),...(row.tags.length?{tags:row.tags}:{}),...(row.cover_asset_id?{cover:{assetId:row.cover_asset_id,alt:row.cover_alt,position:row.cover_position}}:{})};
}
