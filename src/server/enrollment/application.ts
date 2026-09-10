import {clerkConfiguration} from '../../config/clerk.ts';
import {databaseConfiguration} from '../../config/database.ts';
import {EnrollmentService} from './service.ts';
export async function applicationEnrollment(){
 if(clerkConfiguration(process.env)!=='configured'||databaseConfiguration(process.env).state!=='configured')throw new Error('AUTH_NOT_CONFIGURED');
 const {applicationDatabase}=await import('../database/application.ts');
 const {currentEnrollmentCandidate,clerkMembers}=await import('../members/clerk.ts');
 return new EnrollmentService(applicationDatabase().members,currentEnrollmentCandidate,clerkMembers);
}
