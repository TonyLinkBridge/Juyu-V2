import { applicationMembers } from '../../../../../../server/members/application.ts';
import { memberResponse,readMemberInput } from '../../../../../../server/members/http.ts';
export const dynamic='force-dynamic';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
 return memberResponse(async()=>{
  const service=await applicationMembers(),input=await readMemberInput(request,process.env.APP_ORIGIN);
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw new Error('INVALID_INPUT');
  return service.reconcile((await context.params).id);
 });
}
