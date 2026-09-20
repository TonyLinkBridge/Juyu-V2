import {applicationAuthorization} from '../../../../../server/authorization/application.ts';
import {protectedResponse} from '../../../../../server/authorization/service.ts';

export const dynamic='force-dynamic';
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){
 return protectedResponse(async()=>{
  const service=await applicationAuthorization();
  return service.articleVersion((await context.params).id);
 });
}
