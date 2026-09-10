import {requireFeature} from '../features/repository.ts';
import type {PoolClient} from 'pg';
import {parseFeedback,positiveInteger,feedbackPage,type SavedFeedback,type FeedbackOverview,type FeedbackDetails,type FeedbackSummary} from '../../feedback/model.ts';
function saved(row:{helpful:boolean;comment:string|null;version:number;updated_at:Date}):SavedFeedback{return {helpful:row.helpful,comment:row.comment,version:row.version,updatedAt:row.updated_at.toISOString()};}
export async function readFeedback(client:PoolClient,id:string,revision:number):Promise<SavedFeedback|null>{await requireFeature(client,'feedback');
 positiveInteger(revision);
 const permission=(await client.query('SELECT juyu.can_read_document($1) AS allowed,juyu.can_read_revision($1,$2) AS current',[id,revision])).rows[0];
 if(!permission.allowed)throw new Error('NOT_FOUND');if(!permission.current)throw new Error('VERSION_CHANGED');
 const row=(await client.query('SELECT helpful,comment,version,updated_at FROM juyu.feedback WHERE member_id=juyu.actor_id() AND document_id=$1 AND revision_id=$2',[id,revision])).rows[0];
 return row?saved(row):null;
}
export async function writeFeedback(client:PoolClient,id:string,input:unknown):Promise<SavedFeedback>{await requireFeature(client,'feedback');
 const x=parseFeedback(input);
 return saved((await client.query('SELECT * FROM juyu.save_feedback($1,$2,$3,$4,$5)',[id,x.revision,x.helpful,x.comment,x.expectedVersion])).rows[0]);
}
const aggregate=`SELECT f.document_id AS "documentId",r.title,f.revision_id AS revision,count(*)::int AS total,
 count(*) FILTER(WHERE f.helpful)::int AS helpful,count(*) FILTER(WHERE NOT f.helpful)::int AS unhelpful,
 (d.lifecycle='active' AND d.published_revision_id=f.revision_id) AS current,max(f.updated_at) AS "latestAt"
 FROM juyu.feedback f JOIN juyu.revisions r ON r.document_id=f.document_id AND r.revision_id=f.revision_id JOIN juyu.documents d ON d.id=f.document_id`;
const grouping=' GROUP BY f.document_id,r.title,f.revision_id,d.lifecycle,d.published_revision_id';
function summary(row:Omit<FeedbackSummary,'latestAt'> & {latestAt:Date}):FeedbackSummary{return {...row,latestAt:row.latestAt.toISOString()};}
export async function feedbackOverview(client:PoolClient,requested:unknown):Promise<FeedbackOverview>{await requireFeature(client,'feedback');
 const total=(await client.query('SELECT count(*)::int AS n FROM (SELECT document_id,revision_id FROM juyu.feedback GROUP BY document_id,revision_id) q')).rows[0].n as number;
 const pages=Math.max(1,Math.ceil(total/20)),page=Math.min(feedbackPage(requested),pages);
 const rows=await client.query(aggregate+grouping+' ORDER BY max(f.updated_at) DESC,f.document_id COLLATE "C",f.revision_id DESC LIMIT 20 OFFSET $1',[(page-1)*20]);
 return {items:rows.rows.map(summary),total,page,pages};
}
export async function feedbackDetails(client:PoolClient,id:string,revision:number,requested:unknown):Promise<FeedbackDetails>{await requireFeature(client,'feedback');
 positiveInteger(revision);const row=(await client.query(aggregate+' WHERE f.document_id=$1 AND f.revision_id=$2'+grouping,[id,revision])).rows[0];
 if(!row)throw new Error('NOT_FOUND');const result=summary(row),pages=Math.max(1,Math.ceil(result.total/25)),page=Math.min(feedbackPage(requested),pages);
 const rows=await client.query(`SELECT f.member_id AS "memberId",m.display_name AS "memberName",f.helpful,f.comment,f.updated_at AS "updatedAt" FROM juyu.feedback f JOIN juyu.members m ON m.clerk_user_id=f.member_id WHERE f.document_id=$1 AND f.revision_id=$2 ORDER BY f.updated_at DESC,f.member_id COLLATE "C" LIMIT 25 OFFSET $3`,[id,revision,(page-1)*25]);
 return {summary:result,entries:rows.rows.map(row=>({...row,updatedAt:row.updatedAt.toISOString()})),page,pages};
}
