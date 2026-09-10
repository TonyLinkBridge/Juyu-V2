import {applicationAuthorization} from '../../../../../../server/authorization/application';
import {reviewResponse} from '../../../../../../server/review/http';
import {readBounded,requireMediaOrigin} from '../../../../../../server/media/upload';
export const dynamic='force-dynamic';
export async function GET(request:Request,context:{params:Promise<{id:string}>}){return reviewResponse(async()=>{
 const service=await applicationAuthorization();await service.requireEditorAdmin();
 const params=new URL(request.url).searchParams;
 if([...params.keys()].some(key=>key!=='after')||params.getAll('after').length>1)throw new Error('INVALID_INPUT');
 return service.controlReviewDetail((await context.params).id,params.get('after')??'');
});}
export async function POST(request:Request,context:{params:Promise<{id:string}>}){return reviewResponse(async()=>{
 const service=await applicationAuthorization();await service.requireEditorAdmin();requireMediaOrigin(request,process.env.APP_ORIGIN);
 if(new URL(request.url).search||request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')throw new Error('INVALID_INPUT');
 const bytes=await readBounded(request.body,8192,AbortSignal.any([request.signal,AbortSignal.timeout(15000)]));
 let input:unknown;try{input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new Error('INVALID_INPUT');}
 return service.changeReviewControl((await context.params).id,input);
});}
