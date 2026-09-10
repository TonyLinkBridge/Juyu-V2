import {applicationAuthorization} from '../../../../../../server/authorization/application';
import {mediaResponse,requireMediaOrigin,uploadFile} from '../../../../../../server/media/upload';
import {SupabasePrivateStorage} from '../../../../../../server/storage/supabase';
export const dynamic='force-dynamic';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){return mediaResponse(async()=>{const service=await applicationAuthorization();const id=(await context.params).id;requireMediaOrigin(request,process.env.APP_ORIGIN);return uploadFile(request,id,{authorize:()=>service.media(id),reserve:(assetId,meta)=>service.reserveUpload(id,assetId,meta),finish:(assetId,ready)=>service.finishUpload(assetId,ready),storage:()=>{const origin=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!origin||!key)throw new Error('AUTH_NOT_CONFIGURED');return new SupabasePrivateStorage(origin,key);}});});}
