export async function readFeedbackInput(request:Request,origin:string|undefined):Promise<unknown>{
 if(!origin||request.headers.get('origin')!==new URL(origin).origin||request.headers.get('sec-fetch-site')==='cross-site')throw new Error('FORBIDDEN');
 if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')throw new Error('INVALID_INPUT');
 const reader=request.body?.getReader();if(!reader)throw new Error('INVALID_INPUT');let size=0;const parts:Uint8Array[]=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();throw new Error('INVALID_INPUT');}parts.push(value);}try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw new Error('INVALID_INPUT');}}finally{reader.releaseLock();}
}
export async function feedbackResponse(action:()=>Promise<unknown>):Promise<Response>{
 const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'};
 try{return Response.json(await action(),{headers});}catch(error){
  const raw=error instanceof Error?error.message:'';
  const code=raw.startsWith('FORBIDDEN')?'FORBIDDEN':['FEATURE_DISABLED','AUTH_NOT_CONFIGURED','INVALID_INPUT','NOT_FOUND','VERSION_CHANGED','CONFLICT'].includes(raw)?raw:'SERVICE_UNAVAILABLE';
  return Response.json({error:code},{status:(code==='FORBIDDEN'||code==='FEATURE_DISABLED')?403:code==='INVALID_INPUT'?400:code==='NOT_FOUND'?404:['VERSION_CHANGED','CONFLICT'].includes(code)?409:503,headers});
 }
}
