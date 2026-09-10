import {applicationAuthorization} from '../../../../../../server/authorization/application';
import {historyResponse} from '../../../../../../server/setting-history/http';
export const dynamic='force-dynamic';
export async function GET(request:Request){return historyResponse(async()=>{const service=await applicationAuthorization();await service.requireEditorAdmin();const p=new URL(request.url).searchParams;if([...p.keys()].length!==3||['kind','id','version'].some(k=>p.getAll(k).length!==1)||!/^[1-9][0-9]*$/.test(p.get('version')??''))throw new Error('INVALID_INPUT');return service.settingHistoryDetail({kind:p.get('kind'),id:p.get('id'),version:Number(p.get('version'))});});}
