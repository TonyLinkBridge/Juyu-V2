import {applicationAuthorization} from '../../../../../server/authorization/application';
import {formsResponse,readFormBody,requireFormOrigin} from '../../../../../server/forms/http';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){return formsResponse(async()=>{const service=await applicationAuthorization();return service.formRecord((await params).id);});}
export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){return formsResponse(async()=>{const service=await applicationAuthorization();await service.requireEditorAdmin();requireFormOrigin(request);return service.processFormRecord((await params).id,await readFormBody(request));});}
