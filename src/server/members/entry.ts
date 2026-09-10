import { clerkConfiguration } from '../../config/clerk.ts';
import { databaseConfiguration } from '../../config/database.ts';
export async function bindCurrentMember(){
 if(clerkConfiguration(process.env)!=='configured'||databaseConfiguration(process.env).state!=='configured')throw new Error('AUTH_NOT_CONFIGURED');
 const {applicationDatabase}=await import('../database/application.ts');
 const {currentVerifiedMember}=await import('./clerk.ts');
 const {members}=applicationDatabase();
 return members.locked(async client=>{
  const member=await currentVerifiedMember();if(!member)throw new Error('FORBIDDEN: member not verified');
  return members.bind(member,client);
 },true);
}
