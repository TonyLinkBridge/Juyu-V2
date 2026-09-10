export function historyRevision(value:string):number {
 if(!/^[1-9]\d{0,9}$/.test(value)||Number(value)>2147483647)throw new Error('INVALID_INPUT');
 return Number(value);
}
export function historyQuery(url:URL):{eventPage:number;versionPage:number}{
 const p=url.searchParams;if([...p.keys()].some(k=>!['eventPage','versionPage'].includes(k))||p.getAll('eventPage').length>1||p.getAll('versionPage').length>1)throw new Error('INVALID_INPUT');
 const page=(key:string)=>{const value=p.get(key)??'1';if(!/^[1-9]\d{0,5}$/.test(value))throw new Error('INVALID_INPUT');return Number(value);};
 return {eventPage:page('eventPage'),versionPage:page('versionPage')};
}
export async function historyResponse(action:()=>Promise<unknown>):Promise<Response>{
 const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'};
 try{return Response.json(await action(),{headers});}catch(error){
  const raw=error instanceof Error?error.message.split(':')[0]:'';
  const allowed=['MEMBER_BUSY','INVALID_MEDIA','INVALID_COVER','CONFLICT','FORBIDDEN','NOT_FOUND','INVALID_INPUT','INVALID_STATE','INACTIVE_DOCUMENT','UPLOAD_IN_PROGRESS','UPLOAD_TOO_LARGE','AUTH_NOT_CONFIGURED'];
  const code=allowed.includes(raw)?raw:'HISTORY_UNAVAILABLE';
  const status=code==='FORBIDDEN'?403:code==='NOT_FOUND'?404:code==='INVALID_INPUT'?400:code==='UPLOAD_TOO_LARGE'?413:['MEMBER_BUSY','INVALID_MEDIA','INVALID_COVER','CONFLICT','INVALID_STATE','INACTIVE_DOCUMENT','UPLOAD_IN_PROGRESS'].includes(code)?409:503;
  return Response.json({error:code},{status,headers});
 }
}
