export async function editorResponse(action:()=>Promise<unknown>):Promise<Response> {
 const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'};
 try{return Response.json(await action(),{headers});}
 catch(error){
  const raw=error instanceof Error?error.message.split(':')[0]:'';
  const code=['FORBIDDEN','AUTH_NOT_CONFIGURED','NOT_FOUND','CONFLICT','FIELD_CONFLICT','INVALID_STATE','INACTIVE_DOCUMENT','INVALID_INPUT','INVALID_TITLE','INVALID_BODY','INVALID_QA','INVALID_CATEGORY','INVALID_FIELDS','INVALID_MEDIA','INVALID_COVER','INVALID_PRESENTATION','USE_EDITOR','UPLOAD_TOO_LARGE'].includes(raw)?raw:'EDITOR_UNAVAILABLE';
  const status=code==='FORBIDDEN'?403:code==='NOT_FOUND'?404:['CONFLICT','FIELD_CONFLICT','INVALID_STATE','INACTIVE_DOCUMENT','USE_EDITOR'].includes(code)?409:code==='UPLOAD_TOO_LARGE'?413:code.startsWith('INVALID')?400:503;
  return Response.json({error:code},{status,headers});
 }
}
