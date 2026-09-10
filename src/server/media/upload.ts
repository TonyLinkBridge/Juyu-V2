import {randomUUID,createHash} from 'node:crypto';
import {uploadMetadata} from '../../media/model.ts';
import type {PrivateStorage} from '../storage/contract.ts';
let active=0;
async function consumeBounded(body:ReadableStream<Uint8Array>|null,max:number,signal:AbortSignal,onChunk:(chunk:Uint8Array)=>void):Promise<number>{
 if(!body)throw new Error('INVALID_UPLOAD');const reader=body.getReader();let size=0;
 const abort=()=>{void reader.cancel();};signal.addEventListener('abort',abort,{once:true});
 try{signal.throwIfAborted();while(true){const {done,value}=await reader.read();signal.throwIfAborted();if(done)break;size+=value.length;if(size>max)throw new Error('UPLOAD_TOO_LARGE');onChunk(value);}return size;}finally{signal.removeEventListener('abort',abort);await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export async function readBounded(body:ReadableStream<Uint8Array>|null,max:number,signal:AbortSignal):Promise<Buffer>{
 const chunks:Uint8Array[]=[];const size=await consumeBounded(body,max,signal,chunk=>{chunks.push(chunk);});return Buffer.concat(chunks,size);
}
export function requireMediaOrigin(request:Request,origin:string|undefined){if(!origin||request.headers.get('origin')!==new URL(origin).origin||request.headers.get('sec-fetch-site')==='cross-site')throw new Error('FORBIDDEN');}
export async function uploadFile(request:Request,documentId:string,deps:{authorize:()=>Promise<unknown>;reserve:(id:string,metadata:ReturnType<typeof uploadMetadata>)=>Promise<void>;finish:(id:string,ready:boolean)=>Promise<void>;storage:()=>PrivateStorage}){
 await deps.authorize();if(active>=2)throw new Error('UPLOAD_BUSY');active++;let reserved:string|undefined;
 try{
  if(request.headers.get('content-type')!=='application/octet-stream')throw new Error('INVALID_UPLOAD');
  let filename;try{filename=decodeURIComponent(request.headers.get('x-file-name')??'');}catch{throw new Error('INVALID_UPLOAD');}
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(90000)]);const bytes=await readBounded(request.body,50*1024*1024,signal);const metadata=uploadMetadata(filename,bytes);
  const assetId=randomUUID();await deps.reserve(assetId,metadata);reserved=assetId;const storage=deps.storage();
  // Reuse the validated bytes; Blob/Uint8Array copies multiply peak memory for large uploads.
  const expectedHash=createHash('sha256').update(bytes).digest();
  await storage.put(assetId,new ReadableStream<Uint8Array>({start(controller){controller.enqueue(bytes);controller.close();}}),metadata.mime,signal);
  const response=await storage.read(assetId,undefined,signal);if(response.status!==200||response.headers.get('content-length')!==String(bytes.length)){await response.body?.cancel();throw new Error('UPLOAD_UNCONFIRMED');}
  // Verify every returned byte without retaining a second complete file.
  const hash=createHash('sha256');const checked=await consumeBounded(response.body,bytes.length,signal,chunk=>{hash.update(chunk);});if(checked!==bytes.length||!expectedHash.equals(hash.digest()))throw new Error('UPLOAD_UNCONFIRMED');
  await deps.finish(assetId,true);reserved=undefined;return {id:assetId,filename:metadata.filename,mime:metadata.mime,size:String(metadata.size),status:'ready'};
 }catch(error){if(reserved)await deps.finish(reserved,false).catch(()=>{});throw error;}finally{active--;}
}
export async function mediaResponse(action:()=>Promise<unknown>){const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'};try{return Response.json(await action(),{headers});}catch(e){const raw=e instanceof Error?e.message.split(':')[0]:'';const code=['FORBIDDEN','AUTH_NOT_CONFIGURED','NOT_FOUND','CONFLICT','USE_EDITOR','INVALID_STATE','INACTIVE_DOCUMENT','INVALID_INPUT','INVALID_MEDIA','INVALID_PRESENTATION','INVALID_UPLOAD','UPLOAD_TOO_LARGE','UPLOAD_BUSY'].includes(raw)?raw:'MEDIA_UNAVAILABLE';return Response.json({error:code},{status:code==='FORBIDDEN'?403:code==='NOT_FOUND'?404:['CONFLICT','USE_EDITOR','INVALID_STATE','INACTIVE_DOCUMENT'].includes(code)?409:code.startsWith('INVALID')?400:code==='UPLOAD_TOO_LARGE'?413:code==='UPLOAD_BUSY'?429:503,headers});}}
