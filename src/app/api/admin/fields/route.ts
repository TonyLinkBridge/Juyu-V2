import {applicationAuthorization} from '../../../../server/authorization/application';
import {fieldsResponse} from '../../../../server/fields/http';
export const dynamic='force-dynamic';
export async function GET(){return fieldsResponse(async()=>(await applicationAuthorization()).fields());}
