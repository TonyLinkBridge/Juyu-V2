import {applicationAuthorization} from '../../../../server/authorization/application';
import {categoriesResponse} from '../../../../server/categories/http';
export const dynamic='force-dynamic';
export async function GET(){return categoriesResponse(async()=>(await applicationAuthorization()).categories());}
