import { AuthorizationService } from './service.ts';
import { clerkConfiguration } from '../../config/clerk.ts';
import { databaseConfiguration } from '../../config/database.ts';
/** Provider proof is re-read per operation; no browser-supplied identity or fallback role. */
export async function applicationAuthorization():Promise<AuthorizationService>{
 if(clerkConfiguration(process.env)!=='configured'||databaseConfiguration(process.env).state!=='configured')throw new Error('AUTH_NOT_CONFIGURED');
 const {applicationDatabase}=await import('../database/application.ts');
 const {bindCurrentMember}=await import('../members/entry.ts');
 const {database}=applicationDatabase();
 return new AuthorizationService(database,bindCurrentMember);
}
