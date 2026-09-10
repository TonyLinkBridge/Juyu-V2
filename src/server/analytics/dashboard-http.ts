import {rangeDays} from '../../analytics/dashboard.ts';
export function dashboardQuery(url:URL){const p=url.searchParams;if([...p.keys()].some(key=>key!=='days')||p.getAll('days').length>1)throw new Error('INVALID_INPUT');return rangeDays(p.get('days')??undefined);}
export async function dashboardResponse(action:()=>Promise<unknown>){
 const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'};
 try{return Response.json(await action(),{headers});}catch(error){const code=error instanceof Error?error.message.split(':')[0]:'';const status=code==='FORBIDDEN'?403:code==='INVALID_INPUT'?400:503;return Response.json({error:status===503?'ANALYTICS_UNAVAILABLE':code},{status,headers});}
}
