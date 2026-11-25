import assert from 'node:assert/strict';
import {test} from 'node:test';
import {loadComponent} from './helpers/render-component.ts';
import {resolveAccountAccess,type StoredAccount} from '../src/server/authentication/account.ts';

function fixture({company='verified',externalRole='admin',revoked=false,providerFails=false}={}){
 let reads=0;
 const account=loadComponent('src/server/authentication/account-clerk.ts',{
  'server-only':{},react:{cache:(fn:unknown)=>fn},
  './clerk.ts':{employeeSession:async()=>({status:'signed_in',userId:'member-1',sessionId:'session-1'})},
  './account.ts':{resolveAccountAccess},
  '../database/application.ts':{applicationDatabase:()=>({members:{account:async():Promise<StoredAccount>=>{
   reads++;
   if(revoked&&reads===2)return {status:'disabled'};
   return {status:'ready',viewer:{id:'member-1',role:'admin',companyVerified:true}};
  }}})},
  './company-clerk.ts':{employeeCompanyAccess:async()=>{
   if(providerFails)throw new Error('provider error');
   return {status:company,userId:'member-1'};
  }},
  './user-read.ts':{readClerkUser:async()=>({})},
  './member.ts':{verifiedMember:()=>({id:'member-1',role:externalRole})},
 });
 return account.currentAccountAccess as ()=>Promise<{status:string}>;
}

test('account adapter requires current company proof and matching roles',async()=>{
 assert.equal((await fixture()()).status,'ready');
 assert.equal((await fixture({company:'denied'})()).status,'missing');
 for(const externalRole of ['support','super_admin']){
  assert.equal((await fixture({externalRole})()).status,'pending');
 }
});

test('account adapter rechecks local revocation after external verification and fails closed',async()=>{
 assert.equal((await fixture({revoked:true})()).status,'disabled');
 assert.equal((await fixture({providerFails:true})()).status,'unavailable');
});
