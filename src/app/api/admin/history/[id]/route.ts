import {applicationAuthorization} from '../../../../../server/authorization/application';
import {historyResponse,historyQuery} from '../../../../../server/history/http';
export const dynamic='force-dynamic';
export async function GET(request:Request,context:{params:Promise<{id:string}>}){return historyResponse(async()=>{
 const service=await applicationAuthorization();await service.requireEditorAdmin();const {eventPage,versionPage}=historyQuery(new URL(request.url));return service.history((await context.params).id,eventPage,versionPage);
});}
