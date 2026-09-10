import {applicationAuthorization} from '../../../../../server/authorization/application';
import {historyResponse} from '../../../../../server/setting-history/http';
import {parseHistoryQuery} from '../../../../../setting-history/model';
export const dynamic='force-dynamic';
export async function GET(request:Request){return historyResponse(async()=>{const service=await applicationAuthorization();await service.requireEditorAdmin();const x=parseHistoryQuery(new URL(request.url).searchParams);return service.settingHistory(x.kind,x.page);});}
