import type {EnrollmentResult} from './service.ts';
/** Used by both the Clerk landing URL and the sign-in page; no caller-supplied destination. */
export async function enrollmentRedirect(inspect:()=>Promise<EnrollmentResult>):Promise<'/help-centre'|null>{
 try{return (await inspect()).status==='ready'?null:'/help-centre';}
 catch{return null;} // Existing company/admin guards handle missing configuration and denial.
}
