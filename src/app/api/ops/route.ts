import {applicationAuthorization} from '../../../server/authorization/application';
import {opsLocale,opsQuery,opsResponse} from '../../../server/ops/http';
export const dynamic='force-dynamic';
export async function GET(request:Request){return opsResponse(async()=>{const url=new URL(request.url),service=await applicationAuthorization();const locale=opsLocale(url);url.searchParams.delete('lang');return service.ops(opsQuery(url),locale);});}
