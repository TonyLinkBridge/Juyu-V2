import {integrationCatalog,type IntegrationId,type Integration} from '../../developers/model.ts';
import {readBounded} from '../media/upload.ts';
export async function probeIntegration(id:IntegrationId,env:Record<string,string|undefined>,deps:{fetcher:typeof fetch;readiness:()=>Promise<{authentication:string;database:string}>}):Promise<Integration>{
 const item=integrationCatalog(env).find(x=>x.id===id)!;
 if(item.configuration==='missing')return item;
 const result=(check:Integration['check'],code:string,scope:string):Integration=>({...item,check,code,scope,checkedAt:new Date().toISOString()});
 if(id==='cron')return result('unsupported','SCHEDULER_NOT_PROBED','configuration_only');
 try{
  if(id==='clerk'||id==='database'){
   const report=await deps.readiness(),ok=(id==='clerk'?report.authentication:report.database)==='ok';
   return result(ok?'ok':'failed',ok?'CHECK_OK':'CHECK_FAILED',id==='clerk'?'public_signing_keys_only':'restricted_database_roles');
  }
  const signal=AbortSignal.timeout(5000);let response:Response;
  if(id==='storage'){
   const origin=new URL(env.NEXT_PUBLIC_SUPABASE_URL!);
   if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)return result('failed','CHECK_FAILED','private_bucket_only');
   response=await deps.fetcher(new URL('/storage/v1/bucket/juyu-private',origin),{headers:{Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,apikey:env.SUPABASE_SERVICE_ROLE_KEY!},signal,cache:'no-store',redirect:'error'});
  }else response=await deps.fetcher('https://slack.com/api/auth.test',{method:'POST',headers:{Authorization:`Bearer ${env.SLACK_BOT_TOKEN}`,'Content-Type':'application/json'},body:'{}',signal,cache:'no-store',redirect:'error'});
  const scope=id==='storage'?'private_bucket_only':'bot_identity_only';
  if(!response.ok){await response.body?.cancel();return result('failed','CHECK_FAILED',scope);}
  const bytes=await readBounded(response.body,16384,signal),data=JSON.parse(new TextDecoder().decode(bytes));
  if(id==='storage')return result(data.id==='juyu-private'&&data.public===false?'ok':'failed',data.id==='juyu-private'&&data.public===false?'CHECK_OK':'PRIVATE_BUCKET_REQUIRED',scope);
  if(data.ok!==true||typeof data.bot_id!=='string')return result('failed','CHECK_FAILED',scope);
  if(data.team_id!==env.ALLOWED_SLACK_TEAM_ID)return result('failed','SLACK_WORKSPACE_MISMATCH',scope);
  return result('ok','CHECK_OK',scope);
 }catch{return result('failed','CHECK_FAILED',id==='storage'?'private_bucket_only':'bot_identity_only');}
}
