import {applicationAuthorization} from '../../../../../../../../../server/authorization/application';
import {historyResponse,historyRevision} from '../../../../../../../../../server/history/http';
import {deliverAsset} from '../../../../../../../../../server/storage/delivery';
import {SupabasePrivateStorage} from '../../../../../../../../../server/storage/supabase';
export const dynamic='force-dynamic';
export async function GET(request:Request,context:{params:Promise<{id:string;revision:string;assetId:string}>}){
 try{const service=await applicationAuthorization();await service.requireEditorAdmin();const p=await context.params,revision=historyRevision(p.revision),q=new URL(request.url).searchParams;
 if([...q.keys()].some(k=>k!=='download')||q.getAll('download').length>1||(q.has('download')&&q.get('download')!=='1'))throw new Error('INVALID_INPUT');
 const origin=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!origin||!key)throw new Error('AUTH_NOT_CONFIGURED');
 return deliverAsset(request,p.assetId,id=>service.historyAsset(p.id,revision,id),new SupabasePrivateStorage(origin,key));
 }catch(error){return historyResponse(async()=>{throw error;});}
}
