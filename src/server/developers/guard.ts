import type {AccountAccess} from '../authentication/account.ts';
import type {Viewer} from '../../domain/model.ts';
import type {PoolClient} from 'pg';
import {isSuperAdmin} from '../../domain/access.ts';
export function developerAccess(access:AccountAccess):boolean{return access.status==='ready'&&isSuperAdmin(access.viewer);}
export async function requireDeveloper(client:PoolClient,viewer:Viewer){
 if(!isSuperAdmin(viewer)||!(await client.query(`SELECT juyu.is_super_admin() AND juyu.actor_id()=$1 AND juyu.review_admin_eligible($1) AND EXISTS(SELECT 1 FROM juyu.members WHERE clerk_user_id=$1 AND observed_role='super_admin') AS ok`,[viewer.id])).rows[0]?.ok)throw new Error('FORBIDDEN');
}
export async function developerResponse(action:()=>Promise<unknown>):Promise<Response>{
 const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'};
 try{return Response.json(await action(),{headers});}catch(e){const raw=e instanceof Error?e.message.split(':')[0]:'';const code=['FORBIDDEN','INVALID_INPUT','CONFLICT','NOT_FOUND','DEVELOPERS_NOT_READY','CHECK_BUSY'].includes(raw)?raw:'DEVELOPERS_UNAVAILABLE';return Response.json({error:code},{status:code==='FORBIDDEN'?403:code==='INVALID_INPUT'?400:code==='NOT_FOUND'?404:code==='CONFLICT'?409:code==='CHECK_BUSY'?429:503,headers});}
}
export async function developerOnly(load:()=>Promise<AccountAccess>,action:(viewer:Viewer)=>Promise<unknown>):Promise<Response>{
 let access:AccountAccess;try{access=await load();}catch{return Response.json({error:'DEVELOPERS_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'private, no-store'}});}
 if(!developerAccess(access)){const status=access.status==='signed_out'?401:['unavailable','unconfigured'].includes(access.status)?503:403;return Response.json({error:status===401?'UNAUTHENTICATED':status===403?'FORBIDDEN':'DEVELOPERS_UNAVAILABLE'},{status,headers:{'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}});}
 return developerResponse(()=>action((access as Extract<AccountAccess,{status:'ready'}>).viewer));
}
