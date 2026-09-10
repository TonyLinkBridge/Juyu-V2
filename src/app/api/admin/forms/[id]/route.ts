import {applicationAuthorization} from '../../../../../server/authorization/application';
import {formsResponse,readFormBody,requireFormOrigin} from '../../../../../server/forms/http';
export const dynamic='force-dynamic';
export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){return formsResponse(async()=>{const service=await applicationAuthorization();await service.requireEditorAdmin();requireFormOrigin(request);return service.saveForm((await params).id,await readFormBody(request));});}
