import type {PoolClient} from 'pg';
import {libraryQuery,type LibraryAsset,type MediaLibraryData,type UploadTargets} from '../../media/library.ts';
const categorySQL=`CASE WHEN a.mime_type LIKE 'image/%' THEN 'image' WHEN a.mime_type LIKE 'video/%' THEN 'video' WHEN a.mime_type LIKE 'audio/%' THEN 'audio' ELSE 'file' END`;
const escapeLike=(value:string)=>value.replace(/[\\%_]/g,'\\$&');
const columns=`a.id,a.filename,a.mime_type AS mime,a.byte_size::text AS size,a.created_at AS "createdAt",a.document_id AS "documentId",r.title AS "documentTitle",coalesce(nullif(btrim(m.display_name),''),'未命名员工') AS "uploadedBy",d.workflow_state<>'in_review' AS "canUpload",
 coalesce((SELECT jsonb_agg(jsonb_build_object('state',links.state,'usage',links.usage)) FROM (
 SELECT DISTINCT CASE WHEN ra.revision_id=d.published_revision_id THEN 'published' ELSE 'draft' END AS state,ra.usage
 FROM juyu.revision_assets ra WHERE ra.asset_id=a.id AND ra.document_id=d.id AND ra.revision_id IN(d.workflow_revision_id,d.published_revision_id)
 ) links),'[]'::jsonb) AS usages`;
const joins=`FROM juyu.assets a JOIN juyu.documents d ON d.id=a.document_id JOIN juyu.revisions r ON r.document_id=d.id AND r.revision_id=d.workflow_revision_id LEFT JOIN juyu.members m ON m.clerk_user_id=a.uploaded_by`;
export async function readMediaLibrary(c:PoolClient,input:Record<string,unknown>):Promise<MediaLibraryData>{
 const query=libraryQuery(input);if(!(await c.query('SELECT juyu.is_admin() allowed')).rows[0]?.allowed)throw new Error('FORBIDDEN');
 const base=`d.lifecycle='active' AND a.status='ready' AND a.filename ILIKE $1 ESCAPE '\\'`;
 const values=[`%${escapeLike(query.q)}%`];
 const grouped=(await c.query<{type:Exclude<typeof query.type,'all'>;n:number}>(`SELECT ${categorySQL} AS type,count(*)::integer AS n ${joins} WHERE ${base} GROUP BY ${categorySQL}`,values)).rows;
 const counts={all:0,image:0,video:0,audio:0,file:0};for(const row of grouped){counts[row.type]=row.n;counts.all+=row.n;}
 const total=counts[query.type],pages=Math.max(1,Math.ceil(total/30)),page=Math.min(query.page,pages);
 const order=query.sort==='name'?'a.filename COLLATE "C",a.id':query.sort==='size'?'a.byte_size DESC,a.id':'a.created_at DESC,a.id';
 const items=(await c.query<LibraryAsset>(`SELECT ${columns} ${joins} WHERE ${base} AND ($2='all' OR ${categorySQL}=$2) ORDER BY ${order} LIMIT 30 OFFSET $3`,[...values,query.type,(page-1)*30])).rows;
 // A selected file must satisfy the same active-owner and upload-ready boundary as delivery.
 const selected=query.file?(items.find(x=>x.id===query.file)??(await c.query<LibraryAsset>(`SELECT ${columns} ${joins} WHERE d.lifecycle='active' AND a.status='ready' AND a.id=$1`,[query.file])).rows[0]??null):null;
 return {query:{...query,page},items,total,page,pages,counts,selected};
}
export async function readUploadTargets(c:PoolClient,input:Record<string,unknown>):Promise<UploadTargets>{
 if(Object.keys(input).some(k=>!['q','page'].includes(k)))throw new Error('INVALID_INPUT');const query=libraryQuery(input);
 if(!(await c.query('SELECT juyu.is_admin() allowed')).rows[0]?.allowed)throw new Error('FORBIDDEN');
 const where=`d.lifecycle='active' AND d.workflow_state<>'in_review' AND r.title ILIKE $1 ESCAPE '\\'`;
 const join=`FROM juyu.documents d JOIN juyu.revisions r ON r.document_id=d.id AND r.revision_id=d.workflow_revision_id`;
 const pattern=`%${escapeLike(query.q)}%`,total=(await c.query<{n:number}>(`SELECT count(*)::integer n ${join} WHERE ${where}`,[pattern])).rows[0].n;
 const pages=Math.max(1,Math.ceil(total/30)),page=Math.min(query.page,pages);
 const items=(await c.query<{id:string;title:string}>(`SELECT d.id,r.title ${join} WHERE ${where} ORDER BY d.updated_at DESC,d.id COLLATE "C" LIMIT 30 OFFSET $2`,[pattern,(page-1)*30])).rows;
 return {items,total,page,pages};
}
