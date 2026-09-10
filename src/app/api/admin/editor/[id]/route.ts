import {applicationAuthorization} from '../../../../../server/authorization/application';
import {readBounded,requireMediaOrigin} from '../../../../../server/media/upload';
import {editorResponse} from '../../../../../server/editor/response';
export const dynamic='force-dynamic';
export async function GET(_request:Request,context:{params:Promise<{id:string}>}) {
 return editorResponse(async()=>(await applicationAuthorization()).editor((await context.params).id));
}
export async function PUT(request:Request,context:{params:Promise<{id:string}>}) {
 return editorResponse(async()=>{
  const service=await applicationAuthorization();await service.requireEditorAdmin();
  requireMediaOrigin(request,process.env.APP_ORIGIN);
  if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')throw new Error('INVALID_INPUT');
  const bytes=await readBounded(request.body,1500000,AbortSignal.any([request.signal,AbortSignal.timeout(15000)]));
  let input:unknown;try{input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new Error('INVALID_INPUT');}
  return service.saveDraft((await context.params).id,input);
 });
}
