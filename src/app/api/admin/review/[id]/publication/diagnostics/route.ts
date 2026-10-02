import {applicationAuthorization} from '../../../../../../../server/authorization/application';
import {reviewResponse} from '../../../../../../../server/review/http';
import {readBounded,requireMediaOrigin} from '../../../../../../../server/media/upload';
import {parsePublicationDiagnostic} from '../../../../../../../review/publication-diagnostics';
export const dynamic='force-dynamic';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){return reviewResponse(async()=>{
 requireMediaOrigin(request,process.env.APP_ORIGIN);
 if(new URL(request.url).search||request.headers.get('content-type')?.split(';')[0].trim()!=='application/json'||!/^[-a-f0-9]{36}$/.test((await context.params).id))throw new Error('INVALID_INPUT');
 const bytes=await readBounded(request.body,1024,AbortSignal.any([request.signal,AbortSignal.timeout(5000)]));
 let input:unknown;try{input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new Error('INVALID_INPUT');}
 const value=parsePublicationDiagnostic(input);
 await (await applicationAuthorization()).requireEditorAdmin();
 console.info(JSON.stringify({event:'juyu.publication-client',...value}));
 return {logged:true};
});}
