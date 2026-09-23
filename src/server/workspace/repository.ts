import type {PoolClient} from 'pg';
import {statuses,workspaceQuery,type QueryInput,type WorkspaceData,type WorkspaceItem} from '../../workspace/model.ts';
import type {Status} from '../../domain/model.ts';
/** Must run inside the verified Admin repeatable-read transaction. Counts never come from a page slice. */
export async function readWorkspace(c:PoolClient,actorId:string,input:QueryInput):Promise<WorkspaceData>{
 if((await c.query('SELECT juyu.is_admin() AS allowed')).rows[0]?.allowed!==true)throw new Error('FORBIDDEN');
 const query=workspaceQuery(input);
 const parameters=[query.q,query.kind,query.scope,actorId];
 const from=`FROM juyu.documents d JOIN juyu.revisions r ON r.document_id=d.id AND r.revision_id=d.workflow_revision_id`;
 const where=`WHERE d.lifecycle='active' AND ($1='' OR strpos(lower(r.title),lower($1))>0)
 AND ($2='all' OR d.kind=$2)
 AND ($3='all' OR ($3='submitted' AND d.submitted_by=$4)
 OR ($3='review' AND d.workflow_state='in_review' AND d.reviewer_id=$4)
 OR ($3='returned' AND d.workflow_state='changes_requested' AND d.submitted_by=$4))`;
 const grouped=await c.query<{status:Status;n:number}>(`SELECT d.workflow_state AS status,count(*)::int AS n ${from} ${where} GROUP BY d.workflow_state`,parameters);
 const counts=Object.fromEntries(statuses.map(s=>[s.id,0])) as Record<Status,number>;
 for(const row of grouped.rows)counts[row.status]=row.n;
 const total=query.status==='all'?Object.values(counts).reduce((a,b)=>a+b,0):counts[query.status];
 const pages=Math.max(1,Math.ceil(total/30)),page=Math.min(query.page,pages);
 const result=await c.query<WorkspaceItem>(`SELECT d.id,r.title,d.kind,d.workflow_state AS status,d.sequence,
 juyu.publication_number(d.id) AS "publicationNumber", r.qa_category AS "qaCategory",r.qa_position AS "qaPosition",r.revision_id AS revision,d.published_revision_id AS "publishedRevision",d.updated_at AS "updatedAt",
 a.display_name AS author,e.display_name AS editor,s.display_name AS submitter,v.display_name AS reviewer,(d.workflow_state='in_review' AND d.reviewer_id=$4) AS "canReview"
 ${from} JOIN juyu.members a ON a.clerk_user_id=r.author_id JOIN juyu.members e ON e.clerk_user_id=r.editor_id
 LEFT JOIN juyu.members s ON s.clerk_user_id=d.submitted_by LEFT JOIN juyu.members v ON v.clerk_user_id=d.reviewer_id
 ${where} AND ($5='all' OR d.workflow_state=$5)
 ORDER BY d.updated_at DESC,d.id COLLATE "C" LIMIT 30 OFFSET $6`,[...parameters,query.status,(page-1)*30]);
 return {query:{...query,page},items:result.rows.map(r=>({...r,updatedAt:new Date(r.updatedAt).toISOString()})),counts,total,page,pages};
}
