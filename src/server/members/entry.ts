import {cache} from 'react';
import {measured} from '../performance.ts';
import { clerkConfiguration } from '../../config/clerk.ts';
import { databaseConfiguration } from '../../config/database.ts';
// Shared only during one server render; later requests and API operations verify again.
export const bindCurrentMember=cache(async function bindCurrentMember(){
 if(clerkConfiguration(process.env)!=='configured'||databaseConfiguration(process.env).state!=='configured')throw new Error('AUTH_NOT_CONFIGURED');
 const {applicationDatabase}=await import('../database/application.ts');
 const {currentVerifiedMember}=await import('./clerk.ts');
 const {members}=applicationDatabase();
 const member=await currentVerifiedMember();if(!member)throw new Error('FORBIDDEN: member not verified');
 return measured('member.bind',()=>members.locked(async client=>{
  return members.bind(member,client);
 },true));
});
