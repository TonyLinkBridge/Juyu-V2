import {AsyncLocalStorage} from 'node:async_hooks';
/** Evidence is shared only inside one explicit verification, never across rechecks. */
export function createVerificationReader<T>(load:(id:string)=>Promise<T>){
 const scope=new AsyncLocalStorage<Map<string,Promise<T>>>();
 return {
  read:(id:string):Promise<T>=>{const reads=scope.getStore();if(!reads)return load(id);let result=reads.get(id);if(!result){result=load(id);reads.set(id,result);}return result;},
  run:<R>(work:()=>Promise<R>):Promise<R>=>scope.run(new Map(),work),
 };
}
