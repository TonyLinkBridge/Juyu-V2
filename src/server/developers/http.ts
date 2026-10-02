import {developerOnly} from './guard.ts';
import {currentAccountAccess} from '../authentication/account-clerk.ts';
import {applicationDevelopers} from './application.ts';
import {requireMediaOrigin,readBounded} from '../media/upload.ts';
import type {DeveloperService} from './service.ts';
export function developerRoute(action:(service:DeveloperService)=>Promise<unknown>){return developerOnly(currentAccountAccess,()=>action(applicationDevelopers()));}
export async function developerInput(request:Request):Promise<Record<string,unknown>>{
 requireMediaOrigin(request,process.env.APP_ORIGIN);
 if(new URL(request.url).search||request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')throw Error('INVALID_INPUT');
 const bytes=await readBounded(request.body,1024,AbortSignal.any([request.signal,AbortSignal.timeout(5000)]));
 let value:unknown;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw Error('INVALID_INPUT');}
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('INVALID_INPUT');return value as Record<string,unknown>;
}
