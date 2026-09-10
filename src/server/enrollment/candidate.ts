import type {CompanyAccess} from '../authentication/company.ts';
import type {AdminUser} from '../authentication/admin.ts';
import {parseRole} from '../../domain/access.ts';
import type {Role} from '../../domain/model.ts';
export interface EnrollmentCandidate{id:string;email:string;displayName:string;role:Role|undefined}
/** Current server-owned company proof and Backend API user, never client role claims. */
export function enrollmentCandidate(company:CompanyAccess,user:AdminUser):EnrollmentCandidate|null{
 if(company.status!=='verified'||user.id!==company.userId||user.banned||user.locked)return null;
 const primary=user.emailAddresses.find(e=>e.id===user.primaryEmailAddressId);
 if(primary?.verification?.status!=='verified'||primary.emailAddress.toLowerCase()!==company.email)return null;
 const raw=user.publicMetadata?.role,role=parseRole(raw);
 if(raw!==undefined&&!role)return null;
 return {id:user.id,email:company.email,displayName:company.email,role:role??undefined};
}
