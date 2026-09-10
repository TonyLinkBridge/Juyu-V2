import {requireMediaOrigin} from '../../../../../server/media/upload';
import {applicationAuthorization} from '../../../../../server/authorization/application';
import {fieldsResponse,readFieldBody} from '../../../../../server/fields/http';
export const dynamic='force-dynamic';
export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){return fieldsResponse(async()=>{const service=await applicationAuthorization();await service.requireEditorAdmin();requireMediaOrigin(request,process.env.APP_ORIGIN);if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')throw new Error('INVALID_INPUT');return service.saveField((await params).id,await readFieldBody(request));});}
