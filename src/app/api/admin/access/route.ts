import { currentAdminAccess } from '../../../../server/authentication/admin-entry';
import { adminOnly } from '../../../../server/authentication/admin';
export const dynamic = 'force-dynamic';
export async function GET() { return adminOnly(currentAdminAccess, async () => ({ status: 'authorized', contentAccess: 'not_configured' })); }
