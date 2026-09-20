import {applicationAuthorization} from '../../../../server/authorization/application.ts';
import {fragmentInput,fragmentResponse} from '../../../../server/fragments/http.ts';

export const dynamic='force-dynamic';
export async function GET(){return fragmentResponse(async()=>(await applicationAuthorization()).reusableFragments());}
export async function POST(request:Request){return fragmentResponse(async()=>{
 const service=await applicationAuthorization();
 await service.requireEditorAdmin();
 return service.createReusableFragment(await fragmentInput(request));
});}
