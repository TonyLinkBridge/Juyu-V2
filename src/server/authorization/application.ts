import { AuthorizationService } from './service.ts';
import { clerkConfiguration } from '../../config/clerk.ts';
import { databaseConfiguration } from '../../config/database.ts';
/** A signed Clerk session identifies the account; the server-owned member directory supplies its role. */
export async function applicationAuthorization():Promise<AuthorizationService>{
 if(clerkConfiguration(process.env)!=='configured'||databaseConfiguration(process.env).state!=='configured')throw new Error('AUTH_NOT_CONFIGURED');
 const {applicationDatabase}=await import('../database/application.ts');
 const {currentAccountViewer}=await import('../authentication/account-clerk.ts');
 const {database}=applicationDatabase();
 return new AuthorizationService(database,currentAccountViewer);
}
