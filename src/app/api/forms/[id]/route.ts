import {applicationAuthorization} from '../../../../server/authorization/application';
import {formsResponse} from '../../../../server/forms/http';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){return formsResponse(async()=>{const service=await applicationAuthorization();return service.form((await params).id);});}
