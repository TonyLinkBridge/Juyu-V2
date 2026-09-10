export async function lifecycleResponse(action:()=>Promise<unknown>):Promise<Response>{
 const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'};
 try{return Response.json(await action(),{headers});}catch(error){
  const raw=error instanceof Error?error.message.split(':')[0]:'';
  const code=['FORBIDDEN','AUTH_NOT_CONFIGURED','CONFLICT','INVALID_STATE','UPLOAD_IN_PROGRESS','INVALID_INPUT','CONFIRMATION_REQUIRED','NOT_FOUND','UPLOAD_TOO_LARGE'].includes(raw)?raw:'LIFECYCLE_UNAVAILABLE';
  const status=code==='FORBIDDEN'?403:code==='NOT_FOUND'?404:['CONFLICT','INVALID_STATE','UPLOAD_IN_PROGRESS'].includes(code)?409:['INVALID_INPUT','CONFIRMATION_REQUIRED'].includes(code)?400:code==='UPLOAD_TOO_LARGE'?413:503;
  return Response.json({error:code},{status,headers});
 }
}
