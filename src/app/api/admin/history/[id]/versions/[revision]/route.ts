import {applicationAuthorization} from '../../../../../../../server/authorization/application';
import {historyResponse,historyRevision} from '../../../../../../../server/history/http';
import {readBounded,requireMediaOrigin} from '../../../../../../../server/media/upload';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string;revision:string}>};
export async function GET(request:Request,context:Context){return historyResponse(async()=>{const service=await applicationAuthorization();await service.requireEditorAdmin();if(new URL(request.url).search)throw new Error('INVALID_INPUT');const p=await context.params;return service.historyVersion(p.id,historyRevision(p.revision));});}
export async function POST(request:Request,context:Context){return historyResponse(async()=>{
 const service=await applicationAuthorization();await service.requireEditorAdmin();requireMediaOrigin(request,process.env.APP_ORIGIN);
 if(new URL(request.url).search||request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')throw new Error('INVALID_INPUT');
 const p=await context.params,revision=historyRevision(p.revision);const bytes=await readBounded(request.body,8192,AbortSignal.any([request.signal,AbortSignal.timeout(15000)]));
 let input:unknown;try{input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new Error('INVALID_INPUT');}
 if(!input||typeof input!=='object'||!('sourceRevision' in input)||input.sourceRevision!==revision)throw new Error('INVALID_INPUT');
 return service.restoreVersion(p.id,input);
});}
