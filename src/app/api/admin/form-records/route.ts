import {applicationAuthorization} from '../../../../server/authorization/application';
import {formsResponse,formPage} from '../../../../server/forms/http';
export const dynamic='force-dynamic';
export async function GET(request:Request){return formsResponse(async()=>{const service=await applicationAuthorization();return service.formRecords(formPage(new URL(request.url)));});}
