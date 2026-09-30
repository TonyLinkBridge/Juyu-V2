import type {PoolClient} from 'pg';
import {peopleQuery,type PeoplePage} from '../../analytics/dashboard.ts';
import {requireFeature} from '../features/repository.ts';
export async function readAnalyticsPeople(c:PoolClient,input:Record<string,unknown>):Promise<PeoplePage>{
 const {days,page,documentId}=peopleQuery(input);await requireFeature(c,'analytics');
 if(!(await c.query('SELECT juyu.is_admin() allowed')).rows[0]?.allowed)throw new Error('FORBIDDEN');
 if(documentId&&!(await c.query('SELECT juyu.can_read_document($1) allowed',[documentId])).rows[0]?.allowed)throw new Error('NOT_FOUND');
 const result=await c.query<{data:PeoplePage}>(`WITH records AS MATERIALIZED (
 SELECT e.*,t.visible_ms FROM juyu.analytics_events e JOIN juyu.documents d ON d.id=e.document_id
 LEFT JOIN juyu.analytics_visible_time t ON t.view_id=e.id
 WHERE e.kind='view' AND d.lifecycle='active' AND juyu.can_read_document(d.id)
 AND e.occurred_at>=transaction_timestamp()-$1::integer*interval '24 hours' AND e.occurred_at<=transaction_timestamp()
 AND ($2::text IS NULL OR e.document_id=$2)
 ), people AS MATERIALIZED (
 SELECT e.member_id AS "memberId",coalesce(nullif(btrim(m.display_name),''),'未命名员工') AS "displayName",count(*)::integer AS views,
 count(DISTINCT e.document_id)::integer AS documents,count(e.visible_ms)::integer AS "measuredViews",round(avg(e.visible_ms))::integer AS "averageVisibleMs",max(e.occurred_at) AS "lastOpened"
 FROM records e JOIN juyu.members m ON m.clerk_user_id=e.member_id GROUP BY e.member_id,m.display_name
 ), bounds AS (SELECT count(*)::integer AS total,greatest(1,ceil(count(*)/50.0)::integer) AS pages FROM people),
 selected AS (SELECT total,pages,least($3::integer,pages) AS page FROM bounds)
 SELECT jsonb_build_object('total',s.total,'page',s.page,'pages',s.pages,'items',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM (SELECT * FROM people ORDER BY views DESC,"memberId" COLLATE "C" LIMIT 50 OFFSET (s.page-1)*50) p),'[]'::jsonb)) AS data FROM selected s`,[days,documentId??null,page]);
 return result.rows[0].data;
}
