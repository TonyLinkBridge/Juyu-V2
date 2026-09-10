import { applicationAuthorization } from '../../../../../server/authorization/application.ts';
import { currentAdminAccess } from '../../../../../server/authentication/admin-entry.ts';
import { adminOnly } from '../../../../../server/authentication/admin.ts';

export const dynamic = 'force-dynamic';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return adminOnly(currentAdminAccess, async () => {
    const service = await applicationAuthorization();
    return service.management((await context.params).id);
  });
}
