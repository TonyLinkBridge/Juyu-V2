import {applicationAuthorization} from '../../../../server/authorization/application';
import {lifecycleResponse} from '../../../../server/lifecycle/http';
export const dynamic='force-dynamic';
export async function GET(request:Request){return lifecycleResponse(async()=>{const service=await applicationAuthorization();await service.requireEditorAdmin();const url=new URL(request.url);for(const key of ['page','cleanupPage'])if(url.searchParams.getAll(key).length>1)throw new Error('INVALID_INPUT');return service.trash(Number(url.searchParams.get('page')??1),Number(url.searchParams.get('cleanupPage')??1));});}
