import type { AdminAccess } from './admin.ts';
import {adminForAccount} from './admin.ts';
import {clerkConfiguration} from '../../config/clerk.ts';

export async function currentAdminAccess(): Promise<AdminAccess> {
  if(clerkConfiguration(process.env)!=='configured')return {status:'unconfigured'};
  const {currentAccountAccess}=await import('./account-clerk.ts');
  return adminForAccount(await currentAccountAccess());
}
