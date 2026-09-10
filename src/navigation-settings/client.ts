import {normalizeNavigationConfig,parseNavigationWrite,type NavigationConfig,type NavigationWrite} from './model.ts';
import {normalizeCategoryDefinitions,type CategoryDefinition} from '../categories/model.ts';
export class NavigationWriteRejected extends Error {}
const rejectionCodes=new Set(['NAVIGATION_CONFLICT','INVALID_INPUT','FORBIDDEN']);
function configEnvelope(value:unknown):NavigationConfig{
 try{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==1||!Object.hasOwn(value,'config'))throw new Error('INVALID_ACK');return normalizeNavigationConfig((value as {config:unknown}).config);}catch{throw new Error('INVALID_ACK');}
}
async function read(url:string){const response=await fetch(url,{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error(response.status===403?'FORBIDDEN':'NAVIGATION_UNAVAILABLE');return response.json() as Promise<unknown>;}
export async function readNavigationSettings():Promise<{config:NavigationConfig;categories:CategoryDefinition[]}>{
 const [navigation,categoryData]=await Promise.all([read('/api/admin/navigation'),read('/api/admin/categories')]);
 try{return {config:configEnvelope(navigation),categories:normalizeCategoryDefinitions(categoryData)};}catch{throw new Error('INVALID_ACK');}
}
export async function saveNavigationSettings(input:NavigationWrite):Promise<NavigationConfig>{
 let write:NavigationWrite;try{write=parseNavigationWrite(input);}catch{throw new NavigationWriteRejected('INVALID_INPUT');}
 const response=await fetch('/api/admin/navigation',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(write),signal:AbortSignal.timeout(20000)});
 if(!response.ok){
  if(response.status>=400&&response.status<500){const body=await response.json().catch(()=>null);const fallback=response.status===403?'FORBIDDEN':response.status===409?'NAVIGATION_CONFLICT':'WRITE_REJECTED';throw new NavigationWriteRejected(rejectionCodes.has(body?.error)?body.error:fallback);}
  throw new Error('UNKNOWN_RESULT');
 }
 const config=configEnvelope(await response.json());
 if(config.version!==write.expectedVersion+1||JSON.stringify(config.entries)!==JSON.stringify(write.entries))throw new Error('INVALID_ACK');
 return config;
}
