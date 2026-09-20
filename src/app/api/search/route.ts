import {applicationAuthorization} from '../../../server/authorization/application';
import {searchDialogResponse} from '../../../server/search/dialog-http';

export const dynamic='force-dynamic';

export async function GET(request:Request){
 return searchDialogResponse(new URL(request.url),async(query,scope,locale)=>(await(await applicationAuthorization()).search(query,undefined,scope,locale)).search);
}
