import {validObjectKey, type PrivateStorage} from './contract.ts';

/** Server-only jobs returned by an authorization query, never browser-supplied object paths. */
export interface StorageCleanupJob {id:string; object_key:string; bucket:string}
export interface StorageCleanupResult {attempted:number; completed:number; pending:number}

async function withinDeadline<T>(operation:()=>Promise<T>,signal:AbortSignal):Promise<T>{
  signal.throwIfAborted();
  let abort!:()=>void;
  const cancelled=new Promise<never>((_,reject)=>{
    abort=()=>reject(signal.reason);
    signal.addEventListener('abort',abort,{once:true});
  });
  try{return await Promise.race([operation(),cancelled]);}
  finally{signal.removeEventListener('abort',abort);}
}

/** Process at most 25 jobs within a shared deadline. Persistence is acknowledged after verified absence. */
export async function runStorageCleanup(
  jobs: readonly StorageCleanupJob[],
  store: PrivateStorage,
  finish: (jobId:string)=>Promise<unknown>,
  signal?:AbortSignal,
  onAttempt?:(jobId:string)=>Promise<unknown>,
):Promise<StorageCleanupResult>{
  const timeout=AbortSignal.timeout(20_000);
  const batchSignal=signal?AbortSignal.any([signal,timeout]):timeout;
  let attempted=0,completed=0;
  for(const job of jobs.slice(0,25)){
    if(batchSignal.aborted)break;
    attempted++;
    if(!validObjectKey(job.id)||!validObjectKey(job.object_key)||job.bucket!=='juyu-private'||!store.remove)continue;
    try{
      // Record an attempt only when this job is reached, so untouched jobs keep their retry priority.
      if(onAttempt)await withinDeadline(()=>onAttempt(job.id),batchSignal);
      batchSignal.throwIfAborted();
      await withinDeadline(()=>store.remove!(job.object_key,batchSignal),batchSignal);
      batchSignal.throwIfAborted();
      await withinDeadline(()=>finish(job.id),batchSignal);
      completed++;
    }catch{
      // Storage/network/authorization/persistence errors retain the durable pending job.
      // Never expose upstream errors, credentials or object paths through the result.
    }
  }
  return {attempted,completed,pending:jobs.length-completed};
}
