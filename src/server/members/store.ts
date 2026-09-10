import type { Pool, PoolClient } from 'pg';
import { checkRole } from '../database/scoped.ts';
import type { VerifiedMember } from '../authentication/member.ts';
import { parseRole } from '../../domain/access.ts';
import type { Viewer } from '../../domain/model.ts';
export class MemberStore {
 private pool:Pool;
 constructor(pool:Pool){this.pool=pool;}
 async read<T>(work:(client:PoolClient)=>Promise<T>):Promise<T>{
  const client=await this.pool.connect();
  try {await checkRole(client,'juyu_context_issuer','juyu_runtime');return await work(client);}finally{client.release();}
 }
 async locked<T>(work:(client:PoolClient)=>Promise<T>,shared=false):Promise<T>{
  const client=await this.pool.connect();let locked=false,releaseError:Error|undefined;
  try {
   await checkRole(client,'juyu_context_issuer','juyu_runtime');
   locked=(await client.query(shared?'SELECT pg_try_advisory_lock_shared(84620915) AS acquired':'SELECT pg_try_advisory_lock(84620915) AS acquired')).rows[0].acquired;
   if(!locked)throw new Error('MEMBER_BUSY');
   return await work(client);
  }finally{
   if(locked){try{await client.query(shared?'SELECT pg_advisory_unlock_shared(84620915)':'SELECT pg_advisory_unlock(84620915)');}catch{releaseError=new Error('MEMBER_UNLOCK_FAILED');}}
   client.release(releaseError);
  }
 }
 async available(id:string,client?:PoolClient):Promise<void>{
  const check=async(c:PoolClient)=>{
   const result=await c.query('SELECT disabled_at FROM juyu.members WHERE clerk_user_id=$1',[id]);
   if(result.rows[0]?.disabled_at)throw new Error('FORBIDDEN: member disabled');
   if((await c.query("SELECT 1 FROM juyu.member_operations WHERE target_id=$1 AND status='pending'",[id])).rowCount)throw new Error('MEMBER_PENDING');
   if((await c.query("SELECT 1 FROM juyu.role_enrollments WHERE member_id=$1 AND state='pending'",[id])).rowCount)throw new Error('MEMBER_PENDING');
  };
  return client?check(client):this.read(check);
 }
 async bind(member:VerifiedMember,client?:PoolClient):Promise<Viewer>{
  if(!member?.id?.trim()||!parseRole(member.role)||!member.email?.trim()||!member.displayName?.trim())throw new Error('FORBIDDEN: invalid member');
  const bind=async(c:PoolClient)=>{
   await this.available(member.id,c);
   await c.query(`INSERT INTO juyu.members(clerk_user_id,display_name,verified_email,observed_role,observed_at) VALUES($1,$2,$3,$4,clock_timestamp())
    ON CONFLICT(clerk_user_id) DO UPDATE SET display_name=excluded.display_name,verified_email=excluded.verified_email,observed_role=excluded.observed_role,observed_at=excluded.observed_at`,[member.id,member.displayName,member.email,member.role]);
   await this.available(member.id,c);
   return {id:member.id,role:member.role,companyVerified:true};
  };
  return client?bind(client):this.read(bind);
 }
}
