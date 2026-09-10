import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {createElement} from 'react';
// @ts-expect-error Next bundles the real RSC renderer without public TypeScript declarations.
import {renderToReadableStream} from 'next/dist/compiled/react-server-dom-webpack/server.node.js';

// Only external identity suppliers are replaced; render and verification are production code.
let slackCalls=0;
let active=true;
const user={id:'fixture',banned:false,locked:false,primaryEmailAddressId:'email',emailAddresses:[{id:'email',emailAddress:'staff@example.com',verification:{status:'verified'}}],externalAccounts:[{id:'external',provider:'oauth_slack',providerUserId:'U12345678',emailAddress:'staff@example.com',verification:{status:'verified'}}]};
Object.assign(globalThis, {identityFixture:{user:async()=>user,tokens:async()=>({data:[{externalAccountId:'external',provider:'oauth_slack',token:'fixture-token'}]}),slack:async()=>{slackCalls++;return active?{ok:true,sub:'U12345678',email:'staff@example.com',email_verified:true,'https://slack.com/team_id':'T12345678'}:{ok:false,error:'token_revoked'};}}});
registerHooks({resolve(specifier,context,next){
 let source:string|undefined;
 if(specifier==='@clerk/nextjs/server')source='export async function clerkClient(){return {users:{getUser:globalThis.identityFixture.user,getUserOauthAccessToken:globalThis.identityFixture.tokens}}}';
 if(specifier==='./clerk.ts'&&context.parentURL?.endsWith('/company-clerk.ts'))source="export async function employeeSession(){return {status:'signed_in',userId:'fixture',sessionId:'fixture-session'}}";
 if(specifier==='./slack.ts'&&context.parentURL?.endsWith('/company-clerk.ts'))source='export const slackUserInfo=globalThis.identityFixture.slack';
 return source?{url:`data:text/javascript,${encodeURIComponent(source)}`,shortCircuit:true}:next(specifier,context);
}});
process.env.ALLOWED_EMAIL_DOMAINS='example.com';process.env.ALLOWED_SLACK_TEAM_ID='T12345678';
const {employeeCompanyAccess}=await import('../../src/server/authentication/company-clerk.ts');
async function request(expected:string){
 async function Page(){
  const results=await Promise.all(Array.from({length:5},()=>employeeCompanyAccess()));
  for(const result of results)assert.equal(result.status,expected);
  return createElement('p',null,expected);
 }
 const errors:unknown[]=[];
 const stream=await renderToReadableStream(createElement(Page),{}, {onError:(error:unknown)=>errors.push(error)});
 await new Response(stream).text();
 assert.deepEqual(errors,[]);
}
await request('verified');
assert.equal(slackCalls,1,'five components must share one Slack verification during a render');
active=false;
await request('denied');
assert.equal(slackCalls,2,'the next request must recheck a revoked identity');
await employeeCompanyAccess();await employeeCompanyAccess();
assert.equal(slackCalls,4,'outside React rendering, operations must verify independently');
