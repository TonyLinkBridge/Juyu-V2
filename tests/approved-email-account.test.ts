import assert from 'node:assert/strict';
import test from 'node:test';
import {verifyCompanyAccount, verifyCompanyUser, type CompanyUser} from '../src/server/authentication/company.ts';
import {companyResponse} from '../src/server/authentication/company-response.ts';
import {resolveAdminAccess} from '../src/server/authentication/admin.ts';
import {verifiedMember} from '../src/server/authentication/member.ts';
import {enrollmentCandidate} from '../src/server/enrollment/candidate.ts';

const user:CompanyUser={id:'user_approved',banned:false,locked:false,primaryEmailAddressId:'email_1',emailAddresses:[{id:'email_1',emailAddress:'approved@example.com',verification:{status:'verified'}}],externalAccounts:[]};
const base={ALLOWED_EMAIL_DOMAINS:'example.com',ALLOWED_SLACK_TEAM_ID:'T12345678'};
const approval=JSON.stringify({userId:'user_approved',email:'approved@example.com'});
const env={...base,JUYU_APPROVED_EMAIL_ACCOUNT:approval};
const session={status:'signed_in' as const,userId:user.id,sessionId:'sess_fixture'};
const provider={user:async()=>user,tokens:async()=>{throw new Error('Slack is not required for this approved account');},slack:async()=>{throw new Error('Slack is not required for this approved account');}};

test('server-approved exact account and verified primary email can enter without a linked Slack account',async()=>{
 const proof=await verifyCompanyAccount(session,env,provider);
 assert.deepEqual(proof,{status:'verified',userId:'user_approved',email:'approved@example.com',verification:'approved_email',slackUserId:null,slackTeamId:null});
 assert.deepEqual(await verifyCompanyUser(user.id,env,provider),proof);
});

test('email approval never applies to a different account ID or a changed primary email',async()=>{
 const other={...user,id:'user_other'};
 assert.deepEqual(await verifyCompanyUser(other.id,env,{...provider,user:async()=>other}),{status:'denied',reason:'slack_connection'});
 const changed={...user,emailAddresses:[{...user.emailAddresses[0],emailAddress:'other@example.com'}]};
 assert.deepEqual(await verifyCompanyUser(user.id,env,{...provider,user:async()=>changed}),{status:'denied',reason:'slack_connection'});
});

test('approval keeps company-domain, verified-email, account-lock and account-ID checks',async()=>{
 for(const change of [{banned:true},{locked:true},{id:'user_impostor'}])assert.deepEqual(await verifyCompanyUser(user.id,env,{...provider,user:async()=>({...user,...change})}),{status:'denied',reason:'account'});
 for(const status of ['unverified','pending','expired'])assert.deepEqual(await verifyCompanyUser(user.id,env,{...provider,user:async()=>({...user,emailAddresses:[{...user.emailAddresses[0],verification:{status}}]})}),{status:'denied',reason:'company_email'});
 assert.deepEqual(await verifyCompanyUser(user.id,{...env,ALLOWED_EMAIL_DOMAINS:'other.test'},provider),{status:'denied',reason:'company_email'});
 assert.deepEqual(await verifyCompanyUser(user.id,env,{...provider,user:async()=>({...user,primaryEmailAddressId:'missing'})}),{status:'denied',reason:'company_email'});
});

test('missing, malformed, broad or extra-field approvals cannot bypass Slack',async()=>{
 for(const raw of [undefined,'','not-json','null','[]','true',JSON.stringify([{userId:user.id,email:'approved@example.com'}]),JSON.stringify({userId:'*',email:'approved@example.com'}),JSON.stringify({userId:user.id,email:'*@example.com'}),JSON.stringify({userId:user.id,email:'approved@example.com',role:'super_admin'}),JSON.stringify({email:'approved@example.com'}),JSON.stringify({userId:user.id}),JSON.stringify({userId:user.id,email:123})]){
  assert.deepEqual(await verifyCompanyUser(user.id,{...base,JUYU_APPROVED_EMAIL_ACCOUNT:raw},provider),{status:'denied',reason:'slack_connection'});
 }
 const forged={...user,publicMetadata:{role:'super_admin',approvedEmail:true,companyVerified:true}};
 assert.deepEqual(await verifyCompanyUser(user.id,base,{...provider,user:async()=>forged}),{status:'denied',reason:'slack_connection'});
});

test('approval removal is observed on the next request and does not cache company proof',async()=>{
 assert.equal((await verifyCompanyUser(user.id,env,provider)).status,'verified');
 assert.deepEqual(await verifyCompanyUser(user.id,base,provider),{status:'denied',reason:'slack_connection'});
});

test('existing Slack users still require the configured workspace when an email exception exists',async()=>{
 const slackUser={...user,id:'user_slack',emailAddresses:[{...user.emailAddresses[0],emailAddress:'slack@example.com'}],externalAccounts:[{id:'eac_1',provider:'oauth_slack',providerUserId:'U12345678',emailAddress:'slack@example.com',verification:{status:'verified'}}]};
 const slackProvider={user:async()=>slackUser,tokens:async()=>[{externalAccountId:'eac_1',provider:'oauth_slack',token:'test-token'}],slack:async()=>({ok:true,sub:'U12345678',email:'slack@example.com',email_verified:true,'https://slack.com/team_id':'T12345678'})};
 const expected={status:'verified',userId:'user_slack',email:'slack@example.com',slackUserId:'U12345678',slackTeamId:'T12345678'};
 assert.deepEqual(await verifyCompanyUser(slackUser.id,env,slackProvider),expected);
 assert.deepEqual(await verifyCompanyUser(slackUser.id,{...env,JUYU_APPROVED_EMAIL_ACCOUNT:'invalid-json'},slackProvider),expected);
 assert.deepEqual(await verifyCompanyUser(slackUser.id,env,{...slackProvider,slack:async()=>({...await slackProvider.slack(),'https://slack.com/team_id':'T87654321'})}),{status:'denied',reason:'slack_identity'});
});

test('email company proof preserves current roles and cannot itself grant administrator access',async()=>{
 const proof=await verifyCompanyUser(user.id,env,provider);
 for(const role of ['support','ops','admin','super_admin'] as const){
  const current={...user,publicMetadata:{role}};
  assert.equal(verifiedMember(proof,current)?.role,role);
  assert.equal(enrollmentCandidate(proof,current)?.role,role);
  assert.deepEqual(await resolveAdminAccess(proof,async()=>current),role==='admin'||role==='super_admin'?{status:'admin',userId:user.id}:{status:'denied'});
 }
 const noRole={...user,publicMetadata:{}};
 assert.equal(verifiedMember(proof,noRole),null);
 assert.deepEqual(await resolveAdminAccess(proof,async()=>noRole),{status:'denied'});
});

test('email proof stays private and signed-out sessions cannot use the exception',async()=>{
 const proof=await verifyCompanyUser(user.id,env,provider);
 const response=companyResponse(proof);
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{status:'verified',contentAccess:'not_configured'});
 assert.equal(response.headers.get('cache-control'),'private, no-store');
 assert.deepEqual(await verifyCompanyAccount({status:'signed_out'},env,provider),{status:'signed_out'});
});
