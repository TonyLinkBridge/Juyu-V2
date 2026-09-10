import { applicationMembers } from '../../../../../server/members/application.ts';
import { memberResponse,readMemberInput } from '../../../../../server/members/http.ts';
import { parseMemberChange } from '../../../../../server/members/input.ts';
export const dynamic='force-dynamic';
export async function PATCH(request:Request,context:{params:Promise<{id:string}>}){
 return memberResponse(async()=>{
  const service=await applicationMembers();const input=parseMemberChange(await readMemberInput(request,process.env.APP_ORIGIN));
  return service.change((await context.params).id,input);
 });
}
