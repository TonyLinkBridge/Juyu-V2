import 'server-only';
import {after} from 'next/server';
import {applicationDatabase} from '../database/application.ts';
import {currentAccountViewer} from '../authentication/account-clerk.ts';
import {applicationReadiness} from '../readiness.ts';
import {DeveloperService} from './service.ts';
import {appendTelemetry,pruneTelemetry} from './repository.ts';
import {observeRequest} from './telemetry.ts';
import {probeIntegration} from './probes.ts';
import {persistConnectionResult} from './connection-record.ts';
import {safeTelemetry,type Telemetry,type IntegrationId,type Integration} from '../../developers/model.ts';
export function applicationDevelopers(){return new DeveloperService(applicationDatabase().database,currentAccountViewer,process.env);}
let pending:Telemetry[]=[],flushing:Promise<void>|undefined,pauseUntil=0;
async function flush(){
 if(flushing)return flushing;
 flushing=(async()=>{
  await new Promise(resolve=>setTimeout(resolve,150));
  const batch=pending.splice(0,100);if(!batch.length)return;
  try{await appendTelemetry(applicationDatabase().notificationPool,batch);}
  catch{pauseUntil=Date.now()+60000;pending=[];console.warn('DEVELOPER_TELEMETRY_UNAVAILABLE');}
 })().finally(()=>{flushing=undefined;});return flushing;
}
/** Best-effort, bounded and coalesced. A recording failure never changes the original response. */
export function queueTelemetry(value:unknown){
 if(process.env.JUYU_DEVELOPER_LOGGING!=='true'||Date.now()<pauseUntil||pending.length>=100)return;
 const safe=safeTelemetry(value);if(!safe)return;
 pending.push(safe);
 try{after(async()=>{await flush();if(pending.length)await flush();});}catch{pending=[];}
}
export function observeDeveloperRequest(name:'asset'|'pdf'|'publication',work:()=>Promise<Response>){return observeRequest(name,work,queueTelemetry);}
const checks=new Map<IntegrationId,Promise<Integration>>(),checked=new Map<IntegrationId,number>();
export async function checkDeveloperIntegration(id:unknown){
 if(!['clerk','database','storage','slack','cron'].includes(String(id)))throw Error('INVALID_INPUT');
 const key=id as IntegrationId;await applicationDevelopers().access();
 if(checks.has(key))return checks.get(key)!;
 if((checked.get(key)??0)>Date.now()-30000)throw Error('CHECK_BUSY');
 checked.set(key,Date.now());
 const promise=probeIntegration(key,process.env,{fetcher:fetch,readiness:applicationReadiness}).then(async result=>{
  await persistConnectionResult(result,()=>applicationDevelopers().access(),records=>appendTelemetry(applicationDatabase().notificationPool,records));
  return result;
 }).finally(()=>checks.delete(key));checks.set(key,promise);return promise;
}
export async function cleanupDeveloperTelemetry(){try{await pruneTelemetry(applicationDatabase().notificationPool);}catch{console.warn('DEVELOPER_RETENTION_UNAVAILABLE');}}
