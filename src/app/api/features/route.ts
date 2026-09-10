import {applicationAuthorization} from '../../../server/authorization/application';
import {featureResponse} from '../../../server/features/http';
export const dynamic='force-dynamic';
export async function GET(){return featureResponse(async()=>({flags:await(await applicationAuthorization()).features()}));}
