import {requireFeature} from '../features/repository.ts';
import type {PoolClient} from 'pg';
import {rangeDays,type DashboardData} from '../../analytics/dashboard.ts';
/** Caller uses a repeatable-read read-only transaction; the repository rechecks its database identity. */
export async function readAnalyticsDashboard(c:PoolClient,days:unknown=30):Promise<DashboardData> {await requireFeature(c,'analytics');
 const selected=rangeDays(days);
 const allowed=(await c.query<{allowed:boolean}>(`SELECT EXISTS(
  SELECT 1 FROM juyu.current_identity() i JOIN juyu.members m ON m.clerk_user_id=i.member_id
  WHERE i.role IN('admin','super_admin') AND m.observed_at IS NOT NULL AND nullif(btrim(m.verified_email),'') IS NOT NULL
 ) AS allowed`)).rows[0]?.allowed;
 if(allowed!==true)throw new Error('FORBIDDEN');
 const result=await c.query<{data:DashboardData}>(`
 WITH bounds AS MATERIALIZED (
  SELECT transaction_timestamp() AS "asOf",transaction_timestamp()-($1::integer*interval '24 hours') AS "from"
 ), searches AS MATERIALIZED (
  SELECT q.id,q.member_id,q.query,q.result_count FROM juyu.search_queries q CROSS JOIN bounds b
  WHERE q.occurred_at>=b."from" AND q.occurred_at<=b."asOf"
 ), clicks AS MATERIALIZED (
  SELECT e.search_id FROM juyu.analytics_events e JOIN searches s ON s.id=e.search_id AND s.member_id=e.member_id CROSS JOIN bounds b
  WHERE e.kind='search_click' AND e.occurred_at>=b."from" AND e.occurred_at<=b."asOf"
 ), groups AS MATERIALIZED (
  SELECT s.query AS fingerprint,count(*)::integer AS searches,count(*) FILTER(WHERE s.result_count=0)::integer AS "zeroResults",
   count(*) FILTER(WHERE EXISTS(SELECT 1 FROM clicks c WHERE c.search_id=s.id))::integer AS "clickedSearches"
  FROM searches s GROUP BY s.query
 ), readable AS MATERIALIZED (
  SELECT d.id AS "documentId",r.title,d.kind,r.revision_id AS revision FROM juyu.documents d
  JOIN juyu.revisions r ON r.document_id=d.id AND r.revision_id=d.published_revision_id
  WHERE d.lifecycle='active' AND juyu.can_read_revision(d.id,r.revision_id)
 ), views AS MATERIALIZED (
  SELECT r."documentId",r.title,r.kind,r.revision,count(*)::integer AS views FROM readable r
  JOIN juyu.analytics_events e ON e.document_id=r."documentId" CROSS JOIN bounds b
  WHERE e.kind='view' AND e.occurred_at>=b."from" AND e.occurred_at<=b."asOf"
  GROUP BY r."documentId",r.title,r.kind,r.revision
 ), visit_records AS MATERIALIZED (
  SELECT e.id,e.document_id,e.member_id,e.occurred_at,t.visible_ms
  FROM readable r JOIN juyu.analytics_events e ON e.document_id=r."documentId"
  LEFT JOIN juyu.analytics_visible_time t ON t.view_id=e.id CROSS JOIN bounds b
  WHERE e.kind='view' AND e.occurred_at>=b."from" AND e.occurred_at<=b."asOf"
 ), usage_articles AS MATERIALIZED (
  SELECT document_id AS "documentId",count(DISTINCT member_id)::integer AS readers,count(visible_ms)::integer AS "measuredViews",round(avg(visible_ms))::integer AS "averageVisibleMs"
  FROM visit_records GROUP BY document_id
 ), trend AS MATERIALIZED (
  SELECT to_char(day,'YYYY-MM-DD') AS date,count(v.id)::integer AS views
  FROM bounds b CROSS JOIN LATERAL generate_series(date_trunc('day',b."from" AT TIME ZONE 'Asia/Kuala_Lumpur'),date_trunc('day',b."asOf" AT TIME ZONE 'Asia/Kuala_Lumpur'),interval '1 day') day
  LEFT JOIN visit_records v ON date_trunc('day',v.occurred_at AT TIME ZONE 'Asia/Kuala_Lumpur')=day GROUP BY day
 ), feedback AS MATERIALIZED (
  SELECT r."documentId",r.title,r.kind,r.revision,count(*)::integer AS total,count(*) FILTER(WHERE NOT f.helpful)::integer AS negative
  FROM readable r JOIN juyu.feedback f ON f.document_id=r."documentId" AND f.revision_id=r.revision CROSS JOIN bounds b
  WHERE f.updated_at>=b."from" AND f.updated_at<=b."asOf" GROUP BY r."documentId",r.title,r.kind,r.revision
 ) SELECT jsonb_build_object(
  'days',$1::integer,'from',b."from",'asOf',b."asOf",
  'usage',jsonb_build_object('readers',(SELECT count(DISTINCT member_id) FROM visit_records),'measuredViews',(SELECT count(visible_ms) FROM visit_records),'averageVisibleMs',(SELECT round(avg(visible_ms)) FROM visit_records),
   'articles',coalesce((SELECT jsonb_agg(to_jsonb(u)) FROM usage_articles u JOIN (SELECT "documentId" FROM views ORDER BY views DESC,"documentId" COLLATE "C" LIMIT 10) top ON top."documentId"=u."documentId"),'[]'::jsonb),
   'trend',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY date) FROM trend t),'[]'::jsonb)),
  'summary',jsonb_build_object('searches',(SELECT count(*) FROM searches),'zeroResults',(SELECT count(*) FROM searches WHERE result_count=0),
   'clickedSearches',(SELECT count(DISTINCT search_id) FROM clicks),'searchClicks',(SELECT count(*) FROM clicks),
   'views',coalesce((SELECT sum(views) FROM views),0),'feedbackTotal',coalesce((SELECT sum(total) FROM feedback),0),'feedbackNegative',coalesce((SELECT sum(negative) FROM feedback),0)),
  'popularSearches',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.searches DESC,x.fingerprint COLLATE "C") FROM (SELECT * FROM groups ORDER BY searches DESC,fingerprint COLLATE "C" LIMIT 10) x),'[]'::jsonb),
  'zeroResultSearches',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x."zeroResults" DESC,x.searches DESC,x.fingerprint COLLATE "C") FROM (SELECT * FROM groups WHERE "zeroResults">0 ORDER BY "zeroResults" DESC,searches DESC,fingerprint COLLATE "C" LIMIT 10) x),'[]'::jsonb),
  'popularArticles',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.views DESC,x."documentId" COLLATE "C") FROM (SELECT * FROM views ORDER BY views DESC,"documentId" COLLATE "C" LIMIT 10) x),'[]'::jsonb),
  'negativeFeedback',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.negative DESC,x.total DESC,x."documentId" COLLATE "C") FROM (SELECT * FROM feedback WHERE negative>0 ORDER BY negative DESC,total DESC,"documentId" COLLATE "C" LIMIT 10) x),'[]'::jsonb)
 ) AS data FROM bounds b`,[selected]);
 // An unavailable query must throw; only a successful aggregate may report zero.
 if(!result.rows[0]?.data)throw new Error('ANALYTICS_UNAVAILABLE');
 return result.rows[0].data;
}
