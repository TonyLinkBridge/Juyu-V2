import {applicationAuthorization} from '../../../../../server/authorization/application';
import {protectedResponse} from '../../../../../server/authorization/service';
import {exportPDF} from '../../../../../server/pdf/export';
import {renderPDF} from '../../../../../server/pdf/chromium';
import {SupabasePrivateStorage} from '../../../../../server/storage/supabase';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(request:Request,context:{params:Promise<{id:string}>}){
 try{const service=await applicationAuthorization();return exportPDF(request,(await context.params).id,Number(new URL(request.url).searchParams.get('revision')),{
  snapshot:(id,revision)=>service.pdf(id,revision),asset:id=>service.asset(id),render:renderPDF,
  storage:()=>{const origin=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!origin||!key)throw new Error('AUTH_NOT_CONFIGURED');return new SupabasePrivateStorage(origin,key);},
 });}catch(error){return protectedResponse(async()=>{throw error;});}
}
