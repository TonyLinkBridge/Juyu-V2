import type {EmployeeSession} from './session.ts';
import type {Role,Viewer} from '../../domain/model.ts';

export type ReadyViewer=Viewer&{role:Role;companyVerified:true};

export type StoredAccount=
 | {status:'ready';viewer:ReadyViewer}
 | {status:'missing'|'disabled'|'pending'};

export type AccountAccess=
 | {status:'unconfigured'|'signed_out'|'unavailable'|'missing'|'disabled'|'pending'}
 | {status:'ready';viewer:ReadyViewer;sessionId:string};

export async function resolveAccountAccess(
 session:EmployeeSession,
 read:(userId:string)=>Promise<StoredAccount>,
):Promise<AccountAccess>{
 if(session.status!=='signed_in')return session;
 try{
  const account=await read(session.userId);
  return account.status==='ready'?{...account,sessionId:session.sessionId}:account;
 }catch{return {status:'unavailable'};}
}
