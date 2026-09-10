export function recentPage(url:URL):number {
 const p=url.searchParams,value=p.get('page')??'1';if([...p.keys()].some(k=>k!=='page')||p.getAll('page').length>1||!/^[1-9]\d{0,5}$/.test(value))throw new Error('INVALID_INPUT');return Number(value);
}
export async function recentResponse(action:()=>Promise<unknown>){
 const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'};
 try{return Response.json(await action(),{headers});}catch(error){const raw=error instanceof Error?error.message.split(':')[0]:'';const statuses:Record<string,number>={FEATURE_DISABLED:403,FORBIDDEN:403,NOT_FOUND:404,INVALID_INPUT:400,VERSION_CHANGED:409};const code=Object.hasOwn(statuses,raw)?raw:'RECENT_UNAVAILABLE';return Response.json({error:code},{headers,status:statuses[code]??503});}
}
