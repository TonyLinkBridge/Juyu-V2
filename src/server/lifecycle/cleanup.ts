import type {AuthorizationService} from '../authorization/service';
import {runStorageCleanup} from '../storage/cleanup';
import {SupabasePrivateStorage} from '../storage/supabase';
/** A committed purge remains committed even if blob removal is unavailable; pending jobs stay visible. */
export async function completeLifecycleCleanup(service:AuthorizationService,id:string){
 const jobs=await service.cleanupJobs(id);
 if(jobs.length){try{const origin=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(origin&&key)await runStorageCleanup(jobs,new SupabasePrivateStorage(origin,key),job=>service.finishCleanup(id,job),undefined,job=>service.startCleanupAttempt(id,job));}catch{/* Persistent jobs remain pending. */}}
 return {documentId:id,cleanupPending:await service.cleanupPending(id)};
}
