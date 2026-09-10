export function opsQuery(url:URL):number{
 const p=url.searchParams,value=p.get('page')??'1';if([...p.keys()].some(k=>k!=='page')||p.getAll('page').length>1||!/^[1-9]\d{0,5}$/.test(value))throw new Error('INVALID_INPUT');return Number(value);
}
export async function opsResponse(action:()=>Promise<unknown>):Promise<Response>{
 const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'};
 try{return Response.json(await action(),{headers});}catch(error){const raw=error instanceof Error?error.message.split(':')[0]:'';const code=raw==='FORBIDDEN'?'FORBIDDEN':raw==='INVALID_INPUT'?'INVALID_INPUT':'OPS_UNAVAILABLE';return Response.json({error:code},{status:code==='FORBIDDEN'?403:code==='INVALID_INPUT'?400:503,headers});}
}
