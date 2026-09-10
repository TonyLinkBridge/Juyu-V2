import {applicationAuthorization} from '../../../server/authorization/application';
import {opsQuery,opsResponse} from '../../../server/ops/http';
export const dynamic='force-dynamic';
export async function GET(request:Request){return opsResponse(async()=>{const service=await applicationAuthorization();return service.ops(opsQuery(new URL(request.url)));});}
