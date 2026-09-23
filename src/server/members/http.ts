export async function readMemberInput(request:Request,origin:string|undefined):Promise<unknown>{
 if(!origin||request.headers.get('origin')!==new URL(origin).origin||request.headers.get('sec-fetch-site')==='cross-site')throw new Error('FORBIDDEN: origin');
 if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')throw new Error('INVALID_INPUT');
 const reader=request.body?.getReader();if(!reader)throw new Error('INVALID_INPUT');
 const parts:Uint8Array[]=[];let size=0;
 try{
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();throw new Error('INVALID_INPUT');}parts.push(value);}
  try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw new Error('INVALID_INPUT');}
 }finally{reader.releaseLock();}
}
export async function memberResponse(action:()=>Promise<unknown>):Promise<Response>{
 const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'};
 try{return Response.json(await action(),{headers});}
 catch(error){
  const raw=error instanceof Error?error.message:'';
  const code=raw.startsWith('FORBIDDEN')?'FORBIDDEN':['AUTH_NOT_CONFIGURED','INVALID_INPUT','NOT_FOUND','CONFLICT','NO_CHANGE','SELF_CHANGE','MEMBER_BUSY','MEMBER_PENDING','SUPER_ADMIN_REQUIRED','LAST_SUPER_ADMIN'].includes(raw)?raw:'SERVICE_UNAVAILABLE';
  const status=['FORBIDDEN','SUPER_ADMIN_REQUIRED'].includes(code)?403:code==='INVALID_INPUT'?400:code==='NOT_FOUND'?404:['CONFLICT','NO_CHANGE','SELF_CHANGE','MEMBER_BUSY','MEMBER_PENDING','LAST_SUPER_ADMIN'].includes(code)?409:503;
  return Response.json({error:code},{status,headers});
 }
}
