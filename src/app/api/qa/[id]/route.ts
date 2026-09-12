import {applicationAuthorization} from '../../../../server/authorization/application';
import {qaResponse} from '../../../../server/qa/http';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){return qaResponse(async()=>{const {id}=await params;return (await applicationAuthorization()).qaAnswer(id);});}
