import type { CompanyAccess } from './company.ts';
import { isAdministratorRole, parseRole } from '../../domain/access.ts';
import { protectedResponse } from '../authorization/service.ts';
export type AdminAccess = { status: 'unconfigured' | 'unavailable' | 'signed_out' | 'denied' } | { status: 'admin'; userId: string };
export interface AdminUser {
  id: string; banned: boolean; locked: boolean; publicMetadata: { role?: unknown };
  primaryEmailAddressId: string | null;
  emailAddresses: { id: string; emailAddress: string; verification: { status: string } | null }[];
}
export async function resolveAdminAccess(company: CompanyAccess, loadUser: (id: string) => Promise<AdminUser>): Promise<AdminAccess> {
  if (company.status !== 'verified') return { status: company.status };
  try {
    const user = await loadUser(company.userId);
    const primary = user.emailAddresses.find(item => item.id === user.primaryEmailAddressId);
    if (user.id !== company.userId || user.banned || user.locked || !isAdministratorRole(parseRole(user.publicMetadata?.role))
      || primary?.verification?.status !== 'verified' || primary.emailAddress.toLowerCase() !== company.email) return { status: 'denied' };
    return { status: 'admin', userId: user.id };
  } catch { return { status: 'unavailable' }; }
}
export function adminDestination(access: AdminAccess) {
  if (access.status === 'admin') return '/admin';
  if (access.status === 'denied') return '/admin/access-denied';
  if (access.status === 'unavailable') return '/admin/sign-in/error';
  return '/admin/sign-in';
}
export async function adminOnly(loadAccess: () => Promise<AdminAccess>, action: (access: Extract<AdminAccess, { status: 'admin' }>) => Promise<unknown>): Promise<Response> {
  let access: AdminAccess;
  try { access = await loadAccess(); } catch { access = { status: 'unavailable' }; }
  if (access.status === 'admin') return protectedResponse(() => action(access));
  const status = access.status === 'signed_out' ? 401 : access.status === 'denied' ? 403 : 503;
  const error = access.status === 'signed_out' ? 'UNAUTHENTICATED' : access.status === 'denied' ? 'FORBIDDEN' : access.status === 'unconfigured' ? 'AUTH_NOT_CONFIGURED' : 'AUTH_UNAVAILABLE';
  return Response.json({ error }, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization' } });
}
