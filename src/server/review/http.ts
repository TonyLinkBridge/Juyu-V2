/** Private workflow responses must never disclose upstream configuration or database messages. */
export async function reviewResponse(action:()=>Promise<unknown>):Promise<Response>{
 const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'};
 try{return Response.json(await action(),{headers});}
 catch(error){
  const raw=error instanceof Error?error.message.split(':')[0]:'';
  const allowed=['NOT_REVIEWER','REASON_REQUIRED','ENGLISH_REVIEW_REQUIRED','EDIT_REQUIRED','INVALID_APPROVAL','INVALID_MEDIA','FORBIDDEN','NOT_FOUND','CONFLICT','INVALID_REVIEWER','UPLOAD_IN_PROGRESS','INVALID_STATE','INACTIVE_DOCUMENT','INVALID_INPUT','UPLOAD_TOO_LARGE','AUTH_NOT_CONFIGURED'];
  const code=allowed.includes(raw)?raw:'REVIEW_UNAVAILABLE';
  const status=['FORBIDDEN','NOT_REVIEWER'].includes(code)?403:code==='NOT_FOUND'?404:['EDIT_REQUIRED','INVALID_APPROVAL','ENGLISH_REVIEW_REQUIRED','INVALID_MEDIA','CONFLICT','INVALID_REVIEWER','UPLOAD_IN_PROGRESS','INVALID_STATE','INACTIVE_DOCUMENT'].includes(code)?409:['INVALID_INPUT','REASON_REQUIRED'].includes(code)?400:code==='UPLOAD_TOO_LARGE'?413:503;
  return Response.json({error:code},{status,headers});
 }
}
