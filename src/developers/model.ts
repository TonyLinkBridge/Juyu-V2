import {parsePublicationDiagnostic} from '../review/publication-diagnostics.ts';
export type IntegrationId='clerk'|'database'|'storage'|'slack'|'cron';
export type CheckState='not_checked'|'ok'|'failed'|'unsupported';
export interface Integration {id:IntegrationId;name:string;purpose:string;configuration:'present'|'missing';check:CheckState;credentials:{name:string;present:boolean;secret:boolean}[];manageUrl:string;environment:'production'|'preview'|'development';checkedAt?:string;code?:string;scope?:string}
const integrations:[IntegrationId,string,string,string,string[],string[]][]=[
 ['clerk','Clerk 登录','验证员工登录身份','https://dashboard.clerk.com/',['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY','CLERK_SECRET_KEY'],['CLERK_SECRET_KEY']],
 ['database','PostgreSQL 数据库','保存文章、审核及操作记录','https://supabase.com/dashboard',['JUYU_DATABASE_RUNTIME_URL','JUYU_DATABASE_ISSUER_URL'],['JUYU_DATABASE_RUNTIME_URL','JUYU_DATABASE_ISSUER_URL']],
 ['storage','Supabase 文件','存储文章的私密图片与附件','https://supabase.com/dashboard',['NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'],['SUPABASE_SERVICE_ROLE_KEY']],
 ['slack','Slack 通知','将文章变更通知发送到已配置频道','https://api.slack.com/apps',['SLACK_BOT_TOKEN','SLACK_NOTIFICATION_CHANNEL_ID','ALLOWED_SLACK_TEAM_ID','APP_ORIGIN'],['SLACK_BOT_TOKEN']],
 ['cron','定时重试','让 Vercel 定时处理待发送通知','https://vercel.com/dashboard',['CRON_SECRET'],['CRON_SECRET']],
];
export function integrationCatalog(env:Record<string,string|undefined>):Integration[]{
 const environment=env.VERCEL_ENV==='production'?'production':env.VERCEL_ENV==='preview'?'preview':'development';
 return integrations.map(([id,name,purpose,manageUrl,keys,secrets])=>({id,name,purpose,manageUrl,environment,configuration:keys.every(k=>Boolean(env[k]?.trim()))?'present':'missing',check:'not_checked',credentials:keys.map(name=>({name,present:Boolean(env[name]?.trim()),secret:secrets.includes(name)}))}));
}
export type EventSource='audit'|'slack'|'request'|'connection'|'publication-client'|'operator';
export type EventLevel='info'|'warning'|'error';
export interface EventFilter {q:string;days:7|30;source:'all'|EventSource;level:'all'|EventLevel;page:number}
export function parseEventFilter(params:URLSearchParams):EventFilter{
 const allowed=['q','days','source','level','page'];for(const k of params.keys())if(!allowed.includes(k)||params.getAll(k).length!==1)throw new Error('INVALID_INPUT');
 const q=(params.get('q')??'').trim(),days=Number(params.get('days')??30),page=Number(params.get('page')??1),source=params.get('source')??'all',level=params.get('level')??'all';
 if(q.length>120||/[\u0000-\u001f]/.test(q)||![7,30].includes(days)||!Number.isSafeInteger(page)||page<1||page>1000||!['all','audit','slack','request','connection','publication-client','operator'].includes(source)||!['all','info','warning','error'].includes(level))throw new Error('INVALID_INPUT');
 return {q,days:days as 7|30,page,source:source as EventFilter['source'],level:level as EventFilter['level']};
}
export interface Telemetry {source:'request'|'connection'|'publication-client';name:string;level:EventLevel;status?:number;durationMs?:number;code?:string;actorId?:string;documentId?:string;diagnostic?:import('../review/publication-diagnostics.ts').PublicationDiagnostic}
export function safeTelemetry(value:unknown):Telemetry|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;const x=value as Record<string,unknown>;
 if(Object.keys(x).some(k=>!['source','name','level','status','durationMs','code','actorId','documentId','diagnostic'].includes(k))||!['request','connection','publication-client'].includes(String(x.source))||!['info','warning','error'].includes(String(x.level)))return null;
 const names=x.source==='request'?['asset','pdf','publication']:x.source==='connection'?['clerk','database','storage','slack','cron']:['confirm_open','confirm_click','blocked','preflight_start','preflight_failed','publish_start','publish_failed','publish_success','recheck_start','recheck_failed','recheck_success'];
 if(!names.includes(String(x.name)))return null;
 if(x.status!==undefined&&(!Number.isInteger(x.status)||Number(x.status)<100||Number(x.status)>599))return null;
 if(x.durationMs!==undefined&&(!Number.isSafeInteger(x.durationMs)||Number(x.durationMs)<0||Number(x.durationMs)>3600000))return null;
 if(x.code!==undefined&&(x.source!=='connection'||!['CHECK_OK','CHECK_FAILED','PRIVATE_BUCKET_REQUIRED','SLACK_WORKSPACE_MISMATCH','SCHEDULER_NOT_PROBED'].includes(String(x.code))))return null;
 if(x.diagnostic!==undefined){if(x.source!=='publication-client')return null;try{const d=parsePublicationDiagnostic(x.diagnostic);if(d.stage!==x.name)return null;}catch{return null;}}
 if(x.actorId!==undefined&&(x.source!=='publication-client'||typeof x.actorId!=='string'||!/^[-a-zA-Z0-9_]{1,128}$/.test(x.actorId)))return null;
 if(x.documentId!==undefined&&(x.source!=='publication-client'||typeof x.documentId!=='string'||!/^[-a-f0-9]{36}$/.test(x.documentId)))return null;
 return {source:x.source as Telemetry['source'],name:String(x.name),level:x.level as EventLevel,...(x.code!==undefined?{code:String(x.code)}:{}),...(x.actorId!==undefined?{actorId:String(x.actorId)}:{}),...(x.documentId!==undefined?{documentId:String(x.documentId)}:{}),...(x.diagnostic!==undefined?{diagnostic:parsePublicationDiagnostic(x.diagnostic)}:{}),...(x.status!==undefined?{status:Number(x.status)}:{}),...(x.durationMs!==undefined?{durationMs:Number(x.durationMs)}:{})};
}
export interface DeveloperEvent {id:string;at:string;source:EventSource;level:EventLevel;name:string;title:string|null;actor:string|null;documentId:string|null;status:number|null;durationMs:number|null;detail:Record<string,string|number|null>}
export interface EventPage {items:DeveloperEvent[];page:number;hasNext:boolean;filter:EventFilter}
export interface Notification {documentId:string;sequence:number;event:string;title:string|null;actor:string;createdAt:string;attempts:number;nextAttemptAt:string;sentAt:string|null;leaseUntil:string|null;lastError:string|null;state:'sent'|'sending'|'failed'|'pending'}
export function notificationState(row:Pick<Notification,'sentAt'|'leaseUntil'|'lastError'>,now=Date.now()):Notification['state']{return row.sentAt?'sent':row.leaseUntil&&Date.parse(row.leaseUntil)>now?'sending':row.lastError?'failed':'pending';}
export interface NotificationPage {items:Notification[];page:number;hasNext:boolean;totals:{sent:number;failed:number;pending:number};configured:boolean;channel:string|null;retryConfigured:boolean}
export interface Overview {days:7|30;integrations:Integration[];release:string;requests:{count:number;failed:number;averageMs:number|null;since:string|null};timeline:{day:string;count:number;failed:number}[];notifications:NotificationPage['totals'];recent:DeveloperEvent[]}
export const eventNames:Record<string,string>={asset:'图片与附件读取',pdf:'PDF 导出',publication:'文章发布接口',create:'创建草稿',edit:'修改草稿',submit:'提交二审',withdraw:'撤回审核',reassign:'更换审核人',reject:'退回修改',approve:'审核通过',queue:'等待发布',publish:'发布文章',direct_publish:'批准并发布',revision_started:'开始修订',submitted:'提交二审通知',approved:'审核通过通知',changes_requested:'退回修改通知',published:'文章发布通知',updated:'文章更新通知',retry:'重试通知',confirm_open:'打开发布确认',confirm_click:'点击确认发布',preflight_start:'开始发布前检查',preflight_failed:'发布前检查失败',publish_start:'开始发布请求',publish_failed:'发布请求失败',publish_success:'发布请求成功',recheck_start:'开始核对发布结果',recheck_failed:'核对发布结果失败',recheck_success:'核对发布结果成功',blocked:'发布操作被阻止'};
