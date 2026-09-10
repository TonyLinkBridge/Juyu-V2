import type { CompanyAccess } from './company.ts';
import type { AdminUser } from './admin.ts';
import { parseRole } from '../../domain/access.ts';
import type { Role } from '../../domain/model.ts';
export interface VerifiedMember { id:string; role:Role; email:string; displayName:string }
/** Both inputs must originate in this request's server-side provider verification. */
export function verifiedMember(company:CompanyAccess,user:AdminUser):VerifiedMember|null {
 if(company.status!=='verified'||user.id!==company.userId||user.banned||user.locked) return null;
 const role=parseRole(user.publicMetadata?.role),primary=user.emailAddresses.find(e=>e.id===user.primaryEmailAddressId);
 if(!role||primary?.verification?.status!=='verified'||primary.emailAddress.toLowerCase()!==company.email) return null;
 return {id:user.id,role,email:company.email,displayName:company.email};
}
