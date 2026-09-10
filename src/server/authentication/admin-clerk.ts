import 'server-only';
import {readClerkUser} from './user-read.ts';
import { resolveAdminAccess, type AdminAccess } from './admin.ts';
import type { CompanyAccess } from './company.ts';
import { databaseConfiguration } from '../../config/database.ts';
/** Only pass company evidence obtained in this server request, never a browser payload. */
export async function adminForCompany(company: CompanyAccess):Promise<AdminAccess> {
 const access=await resolveAdminAccess(company,readClerkUser);
 if(access.status!=='admin')return access;
 const config=databaseConfiguration(process.env);
 // With no database yet, retain the honest setup page; member/business services remain closed.
 if(config.state==='missing')return access;
 if(config.state==='invalid')return {status:'unavailable'};
 try{
  const {applicationDatabase}=await import('../database/application.ts');
  await applicationDatabase().members.available(access.userId);return access;
 }catch(error){
  const message=error instanceof Error?error.message:'';
  return {status:message.startsWith('FORBIDDEN')||message==='MEMBER_PENDING'?'denied':'unavailable'};
 }
}
