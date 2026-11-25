import 'server-only';
import {cache} from 'react';
import type {Viewer} from '../../domain/model.ts';
import {employeeSession} from './clerk.ts';
import {resolveAccountAccess,type AccountAccess} from './account.ts';
import {employeeCompanyAccess} from './company-clerk.ts';
import {verifiedMember} from './member.ts';
import {readClerkUser} from './user-read.ts';

// Reuse evidence only within this server render, never across requests.
export const currentAccountAccess=cache(async():Promise<AccountAccess>=>{
 const session=await employeeSession();
 if(session.status!=='signed_in')return session;
 try{
  const {applicationDatabase}=await import('../database/application.ts');
  const {members}=applicationDatabase();
  const readAccount=()=>resolveAccountAccess(session,id=>members.account(id));
  const account=await readAccount();
  // Local disable and pending states remain authoritative. Never enroll here.
  if(account.status!=='ready')return account;

  const company=await employeeCompanyAccess();
  if(company.status!=='verified'){
   if(company.status==='denied')return {status:'missing'};
   return {status:company.status};
  }
  if(company.userId!==session.userId)return {status:'missing'};
  const member=verifiedMember(company,await readClerkUser(session.userId));
  if(!member)return {status:'missing'};

  // External verification can take time. Recheck local revocation afterwards.
  const current=await readAccount();
  if(current.status!=='ready')return current;
  // Both upgrades and downgrades must match the stored role before granting access.
  // Do not silently bind a new role or clear a local pending/disabled state here.
  if(member.role!==current.viewer.role)return {status:'pending'};
  return current;
 }catch{return {status:'unavailable'};}
});

export const currentAccountViewer=cache(async():Promise<Viewer|null>=>{
 const access=await currentAccountAccess();
 if(access.status==='ready')return access.viewer;
 if(access.status==='unconfigured')throw new Error('AUTH_NOT_CONFIGURED');
 if(access.status==='unavailable')throw new Error('SERVICE_UNAVAILABLE');
 if(access.status==='pending')throw new Error('MEMBER_PENDING');
 return null;
});
