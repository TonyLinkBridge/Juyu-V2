import {applicationEnrollment} from '../../../../server/enrollment/application.ts';
import {memberResponse,readMemberInput} from '../../../../server/members/http.ts';
export const dynamic='force-dynamic';
export async function GET(){return memberResponse(async()=>(await applicationEnrollment()).inspect());}
export async function POST(request:Request){
 return memberResponse(async()=>{
  const service=await applicationEnrollment(),input=await readMemberInput(request,process.env.APP_ORIGIN);
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw new Error('INVALID_INPUT');
  return service.run();
 });
}
