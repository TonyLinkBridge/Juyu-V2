import {applicationAuthorization} from '../../../server/authorization/application';
import {qaQuery,qaResponse} from '../../../server/qa/http';
export const dynamic='force-dynamic';
export async function GET(request:Request){return qaResponse(async()=>{const query=qaQuery(new URL(request.url)),service=await applicationAuthorization();return service.qa(query.page,query.category);});}
