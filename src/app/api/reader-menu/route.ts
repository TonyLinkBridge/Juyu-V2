import {applicationAuthorization} from '../../../server/authorization/application';
import {navigationResponse} from '../../../server/navigation-settings/http';
export const dynamic='force-dynamic';
export async function GET(){return navigationResponse(async()=>({items:await (await applicationAuthorization()).readerMenu()}));}
