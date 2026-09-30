/** Bound private thumbnail requests; release slots on success, failure and cancellation. */
export function createPreviewQueue(limit=3){
 let running=0;
 const pending:{start:()=>void;signal:AbortSignal;cancel:()=>void}[]=[];
 function pump(){
  while(running<limit&&pending.length){
   const task=pending.shift()!;task.signal.removeEventListener('abort',task.cancel);
   if(task.signal.aborted){task.cancel();continue;}
   running++;task.start();
  }
 }
 return {run<T>(signal:AbortSignal,work:()=>Promise<T>):Promise<T>{
  return new Promise((resolve,reject)=>{
   const task={signal,cancel(){const index=pending.indexOf(task);if(index>=0)pending.splice(index,1);reject(signal.reason);},start(){
    void Promise.resolve().then(work).then(resolve,reject).finally(()=>{running--;pump();});
   }};
   if(signal.aborted){reject(signal.reason);return;}
   signal.addEventListener('abort',task.cancel,{once:true});pending.push(task);pump();
  });
 }};
}
export const previewQueue=createPreviewQueue();
