import {applicationAuthorization} from '../../../../../../server/authorization/application';
import {historyResponse,readHistoryBody} from '../../../../../../server/setting-history/http';
export const dynamic='force-dynamic';
export async function POST(request:Request){return historyResponse(async()=>{const service=await applicationAuthorization();await service.requireEditorAdmin();return service.restoreSetting(await readHistoryBody(request));});}
