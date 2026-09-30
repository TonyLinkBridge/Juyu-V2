import {randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import {contentPath} from '../../reader/content-path.ts';
import type {ContentKind} from '../../domain/model.ts';
import type {NotificationEvent} from './notification-event.ts';

export interface SlackConfig {token:string;channel:string;origin:string}
interface OutboxRow {document_id:string;sequence:number;event:NotificationEvent;kind:ContentKind;locale:'zh-CN'|'en';title:string|null;actor_name:string;reviewer_name:string|null;attempts:number}
const labels:Record<NotificationEvent,string>={
 revision_started:'开始修改已发布资料',submitted:'已提交审核',approved:'审核已通过',changes_requested:'审核退回',published:'新资料已发布',updated:'资料更新已发布',
};
function slackText(value:string){return value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');}
export function slackMessage(row:OutboxRow,config:SlackConfig){
 const name=row.title??'受限资料';
 const path=row.event==='published'||row.event==='updated'?contentPath(row.kind,row.document_id,row.locale):`/admin/editor?article=${encodeURIComponent(row.document_id)}`;
 const url=new URL(path,config.origin).toString();
 const lines=[`*${labels[row.event]}*`,`资料：${slackText(name)}`,`类型：${{article:'知识文章',ops:'OPS Internal',reference:'Reference 速查',qa:'Q&A 问答'}[row.kind]}`,`操作人：${slackText(row.actor_name)}`];
 if(row.event==='submitted'&&row.reviewer_name)lines.push(`二审人：${slackText(row.reviewer_name)}`);
 const text=lines.join('\n');
 return {channel:config.channel,text,blocks:[
  {type:'section',text:{type:'mrkdwn',text}},
  {type:'actions',elements:[{type:'button',text:{type:'plain_text',text:row.event==='published'||row.event==='updated'?'打开正式资料':'打开文章'},url}]},
 ]};
}

/** Claiming and marking are separate from Slack's network call. Failed sends retry. */
export async function dispatchSlackOutbox(pool:Pool,config:SlackConfig,limit:number,transport:typeof fetch=fetch):Promise<{sent:number;failed:number}>{
 if(!config.token||!/^C[A-Z0-9]+$/.test(config.channel)||!/^https?:\/\//.test(config.origin))throw new Error('SLACK_NOT_CONFIGURED');
 const claim=randomUUID();
 const batch=(await pool.query<OutboxRow>(`WITH due AS (
  SELECT document_id,sequence FROM juyu.slack_outbox
  WHERE sent_at IS NULL AND next_attempt_at<=clock_timestamp()
   AND (lease_until IS NULL OR lease_until<clock_timestamp())
  ORDER BY created_at,document_id,sequence LIMIT $1 FOR UPDATE SKIP LOCKED
 ) UPDATE juyu.slack_outbox o SET claim_id=$2,lease_until=clock_timestamp()+interval '2 minutes',attempts=o.attempts+1
 FROM due WHERE o.document_id=due.document_id AND o.sequence=due.sequence
 RETURNING o.document_id,o.sequence,o.event,o.kind,o.locale,o.title,o.actor_name,o.reviewer_name,o.attempts`,
 [Math.max(1,Math.min(limit,10)),claim])).rows;
 let sent=0,failed=0;
 for(const [index,row] of batch.entries()){
  // Slack generally allows one post per second in the same channel.
  if(index>0)await new Promise(resolve=>setTimeout(resolve,1100));
  let retryAfter=0;
  try{
   const response=await transport('https://slack.com/api/chat.postMessage',{
    method:'POST',headers:{Authorization:`Bearer ${config.token}`,'Content-Type':'application/json; charset=utf-8'},
    body:JSON.stringify(slackMessage(row,config)),cache:'no-store',signal:AbortSignal.timeout(8000),
   });
   const body=await response.json() as {ok?:boolean;ts?:string;error?:string};
   if(response.status===429){
    const seconds=Number(response.headers.get('retry-after'));
    retryAfter=Number.isFinite(seconds)?Math.min(3600,Math.max(30,Math.ceil(seconds))):60;
   }
   if(!response.ok||body.ok!==true||!body.ts)throw new Error(response.status===429?'rate_limited':body.error??'slack_unavailable');
   await pool.query(`UPDATE juyu.slack_outbox SET sent_at=clock_timestamp(),slack_ts=$4,claim_id=NULL,lease_until=NULL,last_error=NULL
    WHERE document_id=$1 AND sequence=$2 AND claim_id=$3 AND sent_at IS NULL`,[row.document_id,row.sequence,claim,body.ts]);
   sent+=1;
  }catch(error){
   const code=error instanceof Error&&/^[a-z_]{2,80}$/.test(error.message)?error.message:'delivery_failed';
   const delay=Math.max(retryAfter,Math.min(3600,30*2**Math.min(row.attempts-1,7)));
   await pool.query(`UPDATE juyu.slack_outbox SET next_attempt_at=clock_timestamp()+($4::integer*interval '1 second'),
    claim_id=NULL,lease_until=NULL,last_error=$5 WHERE document_id=$1 AND sequence=$2 AND claim_id=$3 AND sent_at IS NULL`,
    [row.document_id,row.sequence,claim,delay,code]);
   failed+=1;
  }
 }
 return {sent,failed};
}
