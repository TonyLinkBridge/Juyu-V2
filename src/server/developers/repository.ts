import type {Pool,PoolClient} from 'pg';
import {safeTelemetry,notificationState,integrationCatalog,type Telemetry,type EventFilter,type EventPage,type DeveloperEvent,type Notification,type NotificationPage,type Overview} from '../../developers/model.ts';
import {deploymentRelease} from '../../config/readiness.ts';
export async function requireDeveloperSchema(c:PoolClient){if(!(await c.query("SELECT to_regclass('juyu.developer_events') IS NOT NULL AS ok")).rows[0]?.ok)throw new Error('DEVELOPERS_NOT_READY');}
export async function appendTelemetry(pool:Pool,records:Telemetry[]){
 const safe=records.slice(0,100).map(safeTelemetry).filter((x):x is Telemetry=>x!==null);if(!safe.length)return;
 await pool.query({text:`INSERT INTO juyu.developer_events(source,name,level,status,duration_ms,code,actor_id,document_id,diagnostic) SELECT source,name,level,status,duration_ms,code,actor_id,document_id,diagnostic FROM jsonb_to_recordset($1::jsonb) AS x(source text,name text,level text,status integer,duration_ms integer,code text,actor_id text,document_id text,diagnostic jsonb)`,values:[JSON.stringify(safe.map(({durationMs,actorId,documentId,...rest})=>({...rest,duration_ms:durationMs??null,actor_id:actorId??null,document_id:documentId??null})))]});
}
export async function pruneTelemetry(pool:Pool){await pool.query({text:"DELETE FROM juyu.developer_events WHERE id IN(SELECT id FROM juyu.developer_events WHERE source<>'operator' AND at<clock_timestamp()-interval '30 days' ORDER BY at LIMIT 2000)"});}
// Only reviewed provider codes may reach browser DTOs; arbitrary vendor messages are suppressed.
const slackErrors=['rate_limited','slack_unavailable','delivery_failed','channel_not_found','not_in_channel','invalid_auth','not_authed','token_revoked','account_inactive','missing_scope','is_archived','restricted_action'];
const safeSlackError=(column:string)=>`CASE WHEN ${column} IN(${slackErrors.map(code=>"'"+code+"'").join(',')}) THEN ${column} WHEN ${column} IS NOT NULL THEN 'DELIVERY_FAILED' ELSE NULL END`;
const eventProjection=`
 SELECT 'audit:'||a.document_id||':'||a.sequence AS id,a.at,'audit'::text AS source,'info'::text AS level,a.action AS name,r.title,coalesce(m.display_name,a.actor_id) AS actor,a.document_id AS "documentId",NULL::int AS status,NULL::int AS "durationMs",jsonb_build_object('revision',a.revision_id,'sequence',a.sequence) AS detail
 FROM juyu.audit_log a LEFT JOIN juyu.revisions r ON r.document_id=a.document_id AND r.revision_id=a.revision_id LEFT JOIN juyu.members m ON m.clerk_user_id=a.actor_id
 UNION ALL
 SELECT 'slack:'||s.document_id||':'||s.sequence,coalesce(s.sent_at,s.created_at),'slack',CASE WHEN s.sent_at IS NOT NULL THEN 'info' WHEN s.last_error IS NOT NULL THEN 'error' ELSE 'info' END,s.event,s.title,s.actor_name,s.document_id,NULL::int,NULL::int,jsonb_build_object('attempts',s.attempts,'error',${safeSlackError('s.last_error')},'sentAt',s.sent_at)
 FROM juyu.slack_outbox s
 UNION ALL
 SELECT 'event:'||e.id,e.at,e.source,e.level,e.name,NULL::text,coalesce(m.display_name,e.actor_id),e.document_id,e.status,e.duration_ms,jsonb_build_object('sequence',e.sequence,'code',e.code,'attempt',e.diagnostic->>'attempt','reason',e.diagnostic->>'reason','online',e.diagnostic->>'online','draftSequence',e.diagnostic->>'sequence')
 FROM juyu.developer_events e LEFT JOIN juyu.members m ON m.clerk_user_id=e.actor_id`;
const literal=(q:string)=>'%'+q.replace(/[\\%_]/g,'\\$&')+'%';
const eventKind=`CASE WHEN source='request' THEN 'request' WHEN source='connection' THEN 'connection' WHEN source IN('slack','operator') THEN 'notification' WHEN source='publication-client' THEN 'diagnostic' WHEN name IN('publish','direct_publish','queue') THEN 'publication' ELSE 'review' END`;
export async function readDeveloperEvents(c:PoolClient,filter:EventFilter):Promise<EventPage>{
 const values=[filter.days,filter.source,filter.level,literal(filter.q),filter.date??null,filter.levels??null,filter.type??null];
 const matched=`WITH events AS (${eventProjection}),matched AS (SELECT * FROM events WHERE
 CASE WHEN $5::date IS NULL THEN at>=clock_timestamp()-($1::int*interval '1 day') ELSE at>=($5::date::timestamp AT TIME ZONE 'Asia/Kuala_Lumpur') AND at<(($5::date+1)::timestamp AT TIME ZONE 'Asia/Kuala_Lumpur') END
 AND ($2='all' OR source=$2) AND ($3='all' OR level=$3) AND ($6::text[] IS NULL OR level=ANY($6)) AND ($7::text IS NULL OR ${eventKind}=$7)
 AND ($4='%%' OR concat_ws(' ',name,title,actor,"documentId",status::text,detail->>'code',detail->>'reason',detail->>'attempt',detail->>'error') ILIKE $4))`;
 const rows=(await c.query<Omit<DeveloperEvent,'at'>&{at:Date}>(`${matched} SELECT * FROM matched ORDER BY at DESC,id DESC LIMIT 31 OFFSET $8`,[...values,(filter.page-1)*30])).rows;
 const summary=(await c.query(`${matched} SELECT count(*)::int AS total,
 jsonb_build_object('info',count(*) FILTER(WHERE level='info')::int,'warning',count(*) FILTER(WHERE level='warning')::int,'error',count(*) FILTER(WHERE level='error')::int) AS levels,
 coalesce((SELECT jsonb_agg(x) FROM(SELECT source AS id,count(*)::int AS count FROM matched GROUP BY source ORDER BY count DESC,source) x),'[]'::jsonb) AS sources,
 coalesce((SELECT jsonb_agg(x) FROM(SELECT name AS id,count(*)::int AS count FROM matched WHERE source='request' GROUP BY name ORDER BY count DESC,name LIMIT 20) x),'[]'::jsonb) AS interfaces,
 coalesce((SELECT jsonb_agg(x) FROM(SELECT "documentId" AS id,coalesce((array_agg(title ORDER BY at DESC,id DESC) FILTER(WHERE title IS NOT NULL))[1],'文章') AS title,count(*)::int AS count FROM matched WHERE source='audit' AND "documentId" IS NOT NULL GROUP BY "documentId" ORDER BY count DESC,"documentId" LIMIT 20) x),'[]'::jsonb) AS articles
 FROM matched`,values)).rows[0];
 return {items:rows.slice(0,30).map(x=>({...x,at:x.at.toISOString()})),page:filter.page,hasNext:rows.length>30,filter,summary};
}
export async function readDeveloperNotifications(c:PoolClient,params:URLSearchParams,env:Record<string,string|undefined>):Promise<NotificationPage>{
 for(const k of params.keys())if(!['page','state','q'].includes(k)||params.getAll(k).length!==1)throw Error('INVALID_INPUT');
 const page=Number(params.get('page')??1),state=params.get('state')??'all',q=(params.get('q')??'').trim();
 if(!Number.isSafeInteger(page)||page<1||page>1000||!['all','sent','failed','pending','sending'].includes(state)||q.length>120||/[\u0000-\u001f]/.test(q))throw Error('INVALID_INPUT');
 const projection=`SELECT document_id AS "documentId",sequence,event,title,actor_name AS actor,created_at AS "createdAt",attempts,next_attempt_at AS "nextAttemptAt",sent_at AS "sentAt",lease_until AS "leaseUntil",${safeSlackError('last_error')} AS "lastError",CASE WHEN sent_at IS NOT NULL THEN 'sent' WHEN lease_until>clock_timestamp() THEN 'sending' WHEN last_error IS NOT NULL THEN 'failed' ELSE 'pending' END AS state FROM juyu.slack_outbox`;
 const rows=(await c.query(`WITH notifications AS (${projection}) SELECT * FROM notifications WHERE ($1='all' OR state=$1) AND ($2='%%' OR concat_ws(' ',title,event,actor,"documentId") ILIKE $2) ORDER BY "createdAt" DESC,"documentId",sequence DESC LIMIT 31 OFFSET $3`,[state,literal(q),(page-1)*30])).rows;
 const totals=(await c.query(`SELECT count(*) FILTER(WHERE sent_at IS NOT NULL)::int AS sent,count(*) FILTER(WHERE sent_at IS NULL AND last_error IS NOT NULL AND (lease_until IS NULL OR lease_until<=clock_timestamp()))::int AS failed,count(*) FILTER(WHERE sent_at IS NULL AND (last_error IS NULL OR lease_until>clock_timestamp()))::int AS pending FROM juyu.slack_outbox`)).rows[0];
 const items:Notification[]=rows.slice(0,30).map(x=>({...x,createdAt:x.createdAt.toISOString(),nextAttemptAt:x.nextAttemptAt.toISOString(),sentAt:x.sentAt?.toISOString()??null,leaseUntil:x.leaseUntil?.toISOString()??null}));
 for(const row of items)row.state=notificationState(row);
 return {items,page,hasNext:rows.length>30,totals,configured:integrationCatalog(env).find(x=>x.id==='slack')!.configuration==='present',channel:/^[CG][A-Z0-9]{7,63}$/.test(env.SLACK_NOTIFICATION_CHANNEL_ID??'')?env.SLACK_NOTIFICATION_CHANNEL_ID!:null,retryConfigured:Boolean(env.CRON_SECRET?.trim()&&env.CRON_SECRET.trim().length>=16)};
}
export async function readDeveloperOverview(c:PoolClient,days:7|30,env:Record<string,string|undefined>):Promise<Overview>{
 const requests=(await c.query(`SELECT count(*)::int AS count,count(*) FILTER(WHERE status>=400)::int AS failed,round(avg(duration_ms))::int AS "averageMs",min(duration_ms)::int AS "minimumMs",max(duration_ms)::int AS "maximumMs",(SELECT min(at) FROM juyu.developer_events WHERE source='request') AS since FROM juyu.developer_events WHERE source='request' AND at>=((date_trunc('day',clock_timestamp() AT TIME ZONE 'Asia/Kuala_Lumpur')-(($1::int-1)*interval '1 day')) AT TIME ZONE 'Asia/Kuala_Lumpur')`,[days])).rows[0];
 const timeline=(await c.query(`SELECT to_char(d,'YYYY-MM-DD') AS day,count(e.id)::int AS count,count(e.id) FILTER(WHERE e.status>=400)::int AS failed,round(avg(e.duration_ms))::int AS "averageMs" FROM generate_series(date_trunc('day',clock_timestamp() AT TIME ZONE 'Asia/Kuala_Lumpur')-(($1::int-1)*interval '1 day'),date_trunc('day',clock_timestamp() AT TIME ZONE 'Asia/Kuala_Lumpur'),interval '1 day') d LEFT JOIN juyu.developer_events e ON e.source='request' AND (e.at AT TIME ZONE 'Asia/Kuala_Lumpur')>=d AND (e.at AT TIME ZONE 'Asia/Kuala_Lumpur')<d+interval '1 day' GROUP BY d ORDER BY d`,[days])).rows;
 const notificationTimeline=(await c.query(`SELECT to_char(d,'YYYY-MM-DD') AS day,count(s.document_id) FILTER(WHERE s.sent_at IS NOT NULL)::int AS sent,count(s.document_id) FILTER(WHERE s.sent_at IS NULL AND s.last_error IS NOT NULL AND (s.lease_until IS NULL OR s.lease_until<=clock_timestamp()))::int AS failed,count(s.document_id) FILTER(WHERE s.sent_at IS NULL AND (s.last_error IS NULL OR s.lease_until>clock_timestamp()))::int AS pending
 FROM generate_series(date_trunc('day',clock_timestamp() AT TIME ZONE 'Asia/Kuala_Lumpur')-(($1::int-1)*interval '1 day'),date_trunc('day',clock_timestamp() AT TIME ZONE 'Asia/Kuala_Lumpur'),interval '1 day') d LEFT JOIN juyu.slack_outbox s ON (s.created_at AT TIME ZONE 'Asia/Kuala_Lumpur')>=d AND (s.created_at AT TIME ZONE 'Asia/Kuala_Lumpur')<d+interval '1 day' GROUP BY d ORDER BY d`,[days])).rows;
 const recent=await readDeveloperEvents(c,{q:'',days,level:'all',source:'all',page:1}),notifications=await readDeveloperNotifications(c,new URLSearchParams(),env);
 return {days,integrations:await readIntegrations(c,env),release:deploymentRelease(env),requests:{...requests,since:requests.since?.toISOString()??null},timeline,notificationTimeline,notifications:notifications.totals,recent:recent.items.slice(0,8)};
}

export async function readIntegrations(c:PoolClient,env:Record<string,string|undefined>){
 const catalog=integrationCatalog(env);
 const ready=(await c.query("SELECT to_regclass('juyu.developer_events') IS NOT NULL AS ok")).rows[0]?.ok;
 if(!ready)return catalog;
 const rows=(await c.query("SELECT DISTINCT ON(name) name,at,status,code FROM juyu.developer_events WHERE source='connection' ORDER BY name,at DESC,id DESC")).rows;
 return catalog.map(item=>{const row=rows.find(x=>x.name===item.id);return !row||item.configuration==='missing'?item:{...item,check:row.code==='SCHEDULER_NOT_PROBED'?'unsupported' as const:row.status===200?'ok' as const:'failed' as const,code:row.code,checkedAt:row.at.toISOString(),scope:item.id==='clerk'?'public_signing_keys_only':item.id==='database'?'restricted_database_roles':item.id==='storage'?'private_bucket_only':item.id==='slack'?'bot_identity_only':'configuration_only'};});
}
