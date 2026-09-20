import {applicationAuthorization} from '../../../../../server/authorization/application.ts';
import {fragmentInput,fragmentResponse} from '../../../../../server/fragments/http.ts';

export const dynamic='force-dynamic';
export async function PUT(request:Request,context:{params:Promise<{id:string}>}){return fragmentResponse(async()=>{
 const service=await applicationAuthorization();
 await service.requireEditorAdmin();
 const input=await fragmentInput(request);
 if(!input||typeof input!=='object'||Array.isArray(input)||!('expectedVersion' in input)||!Number.isSafeInteger(input.expectedVersion))throw new Error('INVALID_INPUT');
 const {expectedVersion,...content}=input as {expectedVersion:number;id:unknown;title:unknown;blocks:unknown};
 return service.updateReusableFragment((await context.params).id,expectedVersion,content);
});}
