import { clerkConfiguration } from '../../config/clerk.ts';
import type { AdminAccess } from './admin.ts';

export async function currentAdminAccess(): Promise<AdminAccess> {
  if (clerkConfiguration(process.env) !== 'configured') return { status: 'unconfigured' };
  // Lazy loading keeps missing-configuration HTTP tests independent of Next/Clerk internals.
  const { employeeCompanyAccess } = await import('./company-clerk.ts');
  const { adminForCompany } = await import('./admin-clerk.ts');
  return adminForCompany(await employeeCompanyAccess());
}
