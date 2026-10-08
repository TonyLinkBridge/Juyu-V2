import {analyticsRange,rangeDays,type DashboardRange} from '../../analytics/dashboard.ts';
export function dashboardQuery(url:URL):DashboardRange{
 const p=url.searchParams;if([...p.keys()].some(key=>!['days','from','to'].includes(key))||[...new Set(p.keys())].some(key=>p.getAll(key).length>1))throw new Error('INVALID_INPUT');
 if(p.has('from')||p.has('to')){if(p.has('days'))throw new Error('INVALID_INPUT');const range={from:p.get('from'),to:p.get('to')};analyticsRange(range);return range as DashboardRange;}
 return rangeDays(p.get('days')??undefined);
}
export async function dashboardResponse(action:()=>Promise<unknown>){
 const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'};
 try{return Response.json(await action(),{headers});}catch(error){const code=error instanceof Error?error.message.split(':')[0]:'';const status=code==='FORBIDDEN'?403:code==='INVALID_INPUT'?400:503;return Response.json({error:status===503?'ANALYTICS_UNAVAILABLE':code},{status,headers});}
}
