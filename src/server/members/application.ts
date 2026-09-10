import { clerkConfiguration } from '../../config/clerk.ts';
import { databaseConfiguration } from '../../config/database.ts';
import { MemberService } from './service.ts';
export async function applicationMembers(){
 if(clerkConfiguration(process.env)!=='configured'||databaseConfiguration(process.env).state!=='configured')throw new Error('AUTH_NOT_CONFIGURED');
 const {applicationDatabase}=await import('../database/application.ts');
 const {currentVerifiedMember,clerkMembers}=await import('./clerk.ts');
 return new MemberService(applicationDatabase().members,currentVerifiedMember,clerkMembers);
}
