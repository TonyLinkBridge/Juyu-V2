import {applicationAuthorization} from '../../../../server/authorization/application';
import {navigationResponse,readNavigationBody,requireNavigationOrigin} from '../../../../server/navigation-settings/http';
export const dynamic='force-dynamic';
export async function GET(){return navigationResponse(async()=>({config:await (await applicationAuthorization()).navigationSettings()}));}
export async function PUT(request:Request){return navigationResponse(async()=>{const service=await applicationAuthorization();await service.requireEditorAdmin();requireNavigationOrigin(request);return {config:await service.saveNavigationSettings(await readNavigationBody(request))};});}
