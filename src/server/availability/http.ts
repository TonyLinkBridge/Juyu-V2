import {reviewResponse} from '../review/http.ts';
/** Availability's global-member lock fails before mutation; preserve that known rejection. */
export async function availabilityResponse(action:()=>Promise<unknown>):Promise<Response>{
 try{const value=await action();return reviewResponse(async()=>value);}
 catch(error){
  if(error instanceof Error&&error.message==='MEMBER_BUSY')return Response.json({error:'MEMBER_BUSY'},{status:409,headers:{'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}});
  return reviewResponse(async()=>{throw error;});
 }
}
