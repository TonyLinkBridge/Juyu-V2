import {readBounded,requireMediaOrigin} from '../media/upload.ts';

export async function fragmentInput(request:Request):Promise<unknown>{
 requireMediaOrigin(request,process.env.APP_ORIGIN);
 if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')throw new Error('INVALID_INPUT');
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await readBounded(request.body,110_000,AbortSignal.any([request.signal,AbortSignal.timeout(15_000)]))));}
 catch{throw new Error('INVALID_INPUT');}
}
export async function fragmentResponse(action:()=>Promise<unknown>):Promise<Response>{
 const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'};
 try{return Response.json(await action(),{headers});}
 catch(error){const code=error instanceof Error?error.message.split(':')[0]:'';const status=code==='FORBIDDEN'?403:code==='INVALID_INPUT'?400:code==='FRAGMENT_NOT_FOUND'||code==='FRAGMENT_ASSET_UNAVAILABLE'?404:code==='FRAGMENT_EXISTS'||code==='CONFLICT'?409:503;return Response.json({error:status===503?'SERVICE_UNAVAILABLE':code},{status,headers});}
}
