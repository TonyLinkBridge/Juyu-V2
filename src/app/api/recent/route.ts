import {applicationAuthorization} from '../../../server/authorization/application';
import {recentPage,recentResponse} from '../../../server/recent/http';
export const dynamic='force-dynamic';
export async function GET(request:Request){return recentResponse(async()=>{const page=recentPage(new URL(request.url)),service=await applicationAuthorization();return service.recent(page);});}
