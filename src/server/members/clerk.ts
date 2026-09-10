import 'server-only';
import { clerkClient } from '@clerk/nextjs/server';
import { employeeCompanyAccess } from '../authentication/company-clerk.ts';
import { verifyCompanyUser } from '../authentication/company.ts';
import { enrollmentCandidate } from '../enrollment/candidate.ts';
import { verifiedMember } from '../authentication/member.ts';
import { slackUserInfo } from '../authentication/slack.ts';
import type { MemberProvider } from './service.ts';
export const clerkMembers:MemberProvider={
 user:async id=>(await clerkClient()).users.getUser(id),
 async verified(id){
  const client=await clerkClient();
  const company=await verifyCompanyUser(id,process.env,{
   user:key=>client.users.getUser(key),tokens:async key=>(await client.users.getUserOauthAccessToken(key,'slack')).data,slack:slackUserInfo
  });
  if(company.status==='unavailable')throw new Error('SERVICE_UNAVAILABLE');
  if(company.status!=='verified')return null;
  return verifiedMember(company,await client.users.getUser(id));
 },
 async setRole(id,role){await (await clerkClient()).users.updateUserMetadata(id,{publicMetadata:{role}});}
};
export async function currentEnrollmentCandidate(){
 const company=await employeeCompanyAccess();
 if(company.status==='unconfigured')throw new Error('AUTH_NOT_CONFIGURED');
 if(company.status==='unavailable')throw new Error('SERVICE_UNAVAILABLE');
 if(company.status!=='verified')return null;
 return enrollmentCandidate(company,await clerkMembers.user(company.userId));
}

export async function currentVerifiedMember(){
 const candidate=await currentEnrollmentCandidate();
 return candidate?.role?{...candidate,role:candidate.role}:null;
}
