/** Explicit one-time operator command. Accepts one exact Clerk user ID, never an email. */
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {parseEnv} from 'node:util';
import {createClerkClient} from '@clerk/backend';
import {Pool} from 'pg';
import {databaseConfiguration} from '../src/config/database.ts';
import {databasePoolOptions} from '../src/config/database-tls.ts';
import {verifyCompanyUser} from '../src/server/authentication/company.ts';
import {verifiedMember} from '../src/server/authentication/member.ts';
import {slackUserInfo} from '../src/server/authentication/slack.ts';
import {MemberStore} from '../src/server/members/store.ts';
import {promoteInitialSuperAdmin} from '../src/server/members/service.ts';

export function exactClerkUserId(args:string[]):string{
 if(args.length!==1||!/^user_[A-Za-z0-9]+$/.test(args[0]))throw new Error('EXACT_CLERK_USER_ID_REQUIRED');
 return args[0];
}

async function main(){
 const target=exactClerkUserId(process.argv.slice(2));
 Object.assign(process.env,parseEnv(await readFile('.env.local','utf8')));
 const config=databaseConfiguration(process.env),secretKey=process.env.CLERK_SECRET_KEY?.trim();
 if(config.state!=='configured'||!secretKey)throw new Error('AUTH_NOT_CONFIGURED');
 const pool=new Pool({max:1,connectionTimeoutMillis:5000,statement_timeout:15000,...databasePoolOptions(config.issuer,process.env.JUYU_DATABASE_CA_CERT)});
 const client=createClerkClient({secretKey});
 const provider={
  user:(id:string)=>client.users.getUser(id),
  async verified(id:string){
   const company=await verifyCompanyUser(id,process.env,{user:key=>client.users.getUser(key),tokens:async key=>(await client.users.getUserOauthAccessToken(key,'slack')).data,slack:slackUserInfo});
   return verifiedMember(company,await client.users.getUser(id));
  },
  async setRole(id:string,role:import('../src/domain/model.ts').Role){await client.users.updateUserMetadata(id,{publicMetadata:{role}});}
 };
 try{
  const result=await promoteInitialSuperAdmin(new MemberStore(pool),provider,target);
  console.log(JSON.stringify({status:result.status,target:result.target_id,role:result.observed_role}));
 }finally{await pool.end();}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 main().catch(error=>{console.error(error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'INITIAL_SUPER_ADMIN_PROMOTION_FAILED');process.exitCode=1;});
}
