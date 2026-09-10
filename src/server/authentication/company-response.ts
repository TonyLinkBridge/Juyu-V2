import type { CompanyAccess } from './company.ts';
export function companyResponse(access: CompanyAccess): Response {
  const status = access.status === 'verified' ? 200 : access.status === 'signed_out' ? 401 : access.status === 'denied' ? 403 : 503;
  // No user IDs, emails, workspace IDs or OAuth credentials in the public diagnostic result.
  return Response.json({ status: access.status, contentAccess: 'not_configured' }, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization' } });
}
