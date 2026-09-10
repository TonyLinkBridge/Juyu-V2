import { applicationAuthorization } from '../../../../server/authorization/application.ts';
import { protectedResponse } from '../../../../server/authorization/service.ts';
import { deliverAsset } from '../../../../server/storage/delivery.ts';
import { SupabasePrivateStorage } from '../../../../server/storage/supabase.ts';

export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const service = await applicationAuthorization();
    const origin = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!origin || !key) throw new Error('AUTH_NOT_CONFIGURED');
    return deliverAsset(request, (await context.params).id, (id) => service.asset(id), new SupabasePrivateStorage(origin, key));
  } catch (error) { return protectedResponse(async () => { throw error; }); }
}
