import {applicationAuthorization} from '../../../server/authorization/application';
import {referenceQuery,referenceResponse} from '../../../server/reference/http';
export const dynamic='force-dynamic';
export async function GET(request:Request){return referenceResponse(async()=>{const query=referenceQuery(new URL(request.url)),service=await applicationAuthorization();return query.article?service.referenceDetail(query.article,query.locale):service.reference(query.page,query.locale);});}
