import {applicationAuthorization} from '../../../../server/authorization/application';
import {featureResponse,readFeatureBody} from '../../../../server/features/http';
export const dynamic='force-dynamic';
export async function GET(){return featureResponse(async()=>({config:await(await applicationAuthorization()).featureConfig()}));}
export async function PUT(request:Request){return featureResponse(async()=>{const service=await applicationAuthorization();await service.requireEditorAdmin();return {config:await service.saveFeatureConfig(await readFeatureBody(request))};});}
