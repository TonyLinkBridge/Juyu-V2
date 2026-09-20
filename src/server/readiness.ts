import 'server-only';
import {Client} from 'pg';
import {clerkConfiguration} from '../config/clerk';
import {databaseConfiguration} from '../config/database';
import {databasePoolOptions} from '../config/database-tls';
import {getReadinessReport,type Environment,type DependencyState} from '../config/readiness';
import {checkRole} from './database/scoped';
async function authentication(env:Environment):Promise<DependencyState>{
 if(clerkConfiguration(env)!=='configured')return 'not_checked';
 // Only the PUBLIC publishable key is decoded. No secret or user data is sent.
 const host=Buffer.from(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!.split('_')[2],'base64').toString('utf8').slice(0,-1);
 try{const response=await fetch(`https://${host}/.well-known/jwks.json`,{signal:AbortSignal.timeout(2000),cache:'no-store',redirect:'error'});
  if(!response.ok)return 'failed';const data=await response.json();return Array.isArray(data.keys)&&data.keys.some((key:Record<string,unknown>)=>key.kty==='RSA'&&typeof key.n==='string'&&typeof key.e==='string'&&typeof key.kid==='string')?'ok':'failed';
 }catch{return 'failed';}
}
async function database(env:Environment):Promise<DependencyState>{
 const config=databaseConfiguration(env);if(config.state!=='configured')return 'not_checked';
 const results=await Promise.allSettled([['runtime',config.runtime],['issuer',config.issuer]].map(async([kind,url])=>{
  const client=new Client({...databasePoolOptions(url,env.JUYU_DATABASE_CA_CERT),connectionTimeoutMillis:2000,query_timeout:1500,statement_timeout:1200});
  client.on('error',()=>{});
  try{await client.connect();await checkRole(client as unknown as import('pg').PoolClient,kind==='runtime'?'juyu_runtime':'juyu_context_issuer',kind==='runtime'?'juyu_context_issuer':'juyu_runtime');
   const result=await client.query("SELECT to_regclass('juyu.documents') IS NOT NULL AND to_regclass('juyu.request_contexts') IS NOT NULL AND to_regprocedure('juyu.publication_number(text)') IS NOT NULL AS ready");
   if(result.rows[0]?.ready!==true)throw Error('SCHEMA_NOT_READY');
  }finally{await client.end();}
 }));return results.every(result=>result.status==='fulfilled')?'ok':'failed';
}
let cached:{until:number;value:Awaited<ReturnType<typeof probe>>}|undefined;
let pending:Promise<Awaited<ReturnType<typeof probe>>>|undefined;
async function probe(){const [auth,db]=await Promise.all([authentication(process.env),database(process.env)]);return {...getReadinessReport(process.env,{authentication:auth,database:db}),checkedAt:new Date().toISOString(),scope:'public_signing_keys_and_database_roles',authenticationScope:'public_signing_keys_only',loginVerified:false};}
/** Shared probe avoids a public health poll opening unbounded connections. */
export async function applicationReadiness(){
 if(cached&&cached.until>Date.now())return cached.value;
 pending??=probe().then(value=>{cached={value,until:Date.now()+15000};return value;}).finally(()=>{pending=undefined;});return pending;
}
