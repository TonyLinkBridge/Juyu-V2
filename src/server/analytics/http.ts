export async function readAnalyticsBody(request:Request):Promise<unknown>{
 if(new URL(request.url).search||request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json'||!request.body)throw new Error('INVALID_INPUT');
 const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>24000){await reader.cancel();throw new Error('INVALID_INPUT');}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new Error('INVALID_INPUT');}finally{reader.releaseLock();}
}
export async function analyticsResponse(action:()=>Promise<unknown>){
 const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'};
 try{return Response.json(await action(),{headers});}catch(error){const raw=error instanceof Error?error.message.split(':')[0]:'';const statuses:Record<string,number>={FEATURE_DISABLED:403,FORBIDDEN:403,NOT_FOUND:404,INVALID_INPUT:400,VERSION_CHANGED:409,CONFLICT:409,SNAPSHOT_CHANGED:409};const code=Object.hasOwn(statuses,raw)?raw:'ANALYTICS_UNAVAILABLE';return Response.json({error:code},{headers,status:statuses[code]??503});}
}
