import {applicationAuthorization} from '../../../../../server/authorization/application';
import {lifecycleResponse} from '../../../../../server/lifecycle/http';
import {completeLifecycleCleanup} from '../../../../../server/lifecycle/cleanup';
import {readBounded,requireMediaOrigin} from '../../../../../server/media/upload';
export const dynamic='force-dynamic';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){return lifecycleResponse(async()=>{
 const service=await applicationAuthorization();await service.requireEditorAdmin();requireMediaOrigin(request,process.env.APP_ORIGIN);
 if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')throw new Error('INVALID_INPUT');
 const bytes=await readBounded(request.body,8192,AbortSignal.any([request.signal,AbortSignal.timeout(15000)]));
 let input:unknown;try{input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new Error('INVALID_INPUT');}
 const id=(await context.params).id;const result=await service.lifecycle(id,input);
 return result.action==='purge'?{...result,...await completeLifecycleCleanup(service,id)}:result;
 });}
