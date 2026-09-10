import {applicationAuthorization} from '../../../../../server/authorization/application';
import {formsResponse,readFormBody,requireFormOrigin} from '../../../../../server/forms/http';
export const dynamic='force-dynamic';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){return formsResponse(async()=>{const service=await applicationAuthorization();await service.requireFormMember();requireFormOrigin(request);return service.submitForm((await params).id,await readFormBody(request));});}
