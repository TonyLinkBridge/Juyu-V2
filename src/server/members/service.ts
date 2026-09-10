import type { PoolClient } from 'pg';
import type { AdminUser } from '../authentication/admin.ts';
import type { VerifiedMember } from '../authentication/member.ts';
import { parseRole } from '../../domain/access.ts';
import type { Role } from '../../domain/model.ts';
import { MemberStore } from './store.ts';
import { parseMemberChange, type MemberChange } from './input.ts';
export interface MemberProvider {
 user(id:string):Promise<AdminUser>;
 verified(id:string):Promise<VerifiedMember|null>;
 setRole(id:string,role:Role):Promise<void>;
}
export interface Operation {id:string;actor_id:string;target_id:string;kind:'role'|'disable';before_role:Role|null;requested_role:Role|null;requested_disabled:boolean|null;observed_role:Role|null;status:'pending'|'applied'|'conflict';created_at:string;finished_at:string|null;reconciled_by:string|null}
export interface MemberRow {clerk_user_id:string;display_name:string;verified_email:string;disabled_at:string|null;observed_role:Role|null;pending:boolean;enrollment_pending?:boolean;role:Role|null;providerStatus:'active'|'blocked'|'unavailable'}
export interface MemberList {actorId:string;members:MemberRow[];operations:Operation[];nextCursor:string|null}
export class MemberService {
 private store:MemberStore;private authenticate:()=>Promise<VerifiedMember|null>;private provider:MemberProvider;
 constructor(store:MemberStore,authenticate:()=>Promise<VerifiedMember|null>,provider:MemberProvider){this.store=store;this.authenticate=authenticate;this.provider=provider;}
 private async actor(client?:PoolClient):Promise<VerifiedMember>{
  if(!client)return this.store.locked(c=>this.actor(c),true);
  const member=await this.authenticate();
  if(member?.role!=='admin')throw new Error('FORBIDDEN: admin required');
  await this.store.bind(member,client);return member;
 }
 async list(after=''):Promise<MemberList>{
  if(after.length>200)throw new Error('INVALID_INPUT');
  const actor=await this.actor();
  const data=await this.store.read(async c=>({
   rows:(await c.query("SELECT m.*,(EXISTS(SELECT 1 FROM juyu.member_operations o WHERE o.target_id=m.clerk_user_id AND o.status='pending') OR EXISTS(SELECT 1 FROM juyu.role_enrollments e WHERE e.member_id=m.clerk_user_id AND e.state='pending')) AS pending,EXISTS(SELECT 1 FROM juyu.role_enrollments e WHERE e.member_id=m.clerk_user_id AND e.state='pending') AS enrollment_pending FROM juyu.members m WHERE m.verified_email IS NOT NULL AND m.clerk_user_id>$1 ORDER BY m.clerk_user_id LIMIT 26",[after])).rows,
   operations:(await c.query('SELECT * FROM juyu.member_operations ORDER BY created_at DESC LIMIT 50')).rows as Operation[]
  }));
  const rows=data.rows.slice(0,25),members:MemberRow[]=[];
  // Bounded provider work, with explicit unavailable states instead of cached roles.
  for(let i=0;i<rows.length;i+=5){
   const group=await Promise.all(rows.slice(i,i+5).map(async row=>{
    try{const user=await this.provider.user(row.clerk_user_id);if(user.id!==row.clerk_user_id)throw new Error('IDENTITY_MISMATCH');
     return {...row,role:parseRole(user.publicMetadata?.role),providerStatus:user.banned||user.locked?'blocked' as const:'active' as const};
    }catch{return {...row,role:null,providerStatus:'unavailable' as const};}
   }));members.push(...group);
  }
  return {actorId:actor.id,members,operations:data.operations,nextCursor:data.rows.length>25?rows.at(-1).clerk_user_id:null};
 }
 async change(target:string,input:MemberChange):Promise<Operation>{
  const change=parseMemberChange(input);
  if(!target||target.length>200)throw new Error('INVALID_INPUT');
  return this.store.locked(async client=>{
   const actor=await this.actor(client);
   if((await client.query("SELECT 1 FROM juyu.member_operations WHERE status='pending'")).rowCount)throw new Error('MEMBER_PENDING');
   if(target===actor.id)throw new Error('SELF_CHANGE');
   const existing=(await client.query('SELECT * FROM juyu.members WHERE clerk_user_id=$1 AND verified_email IS NOT NULL',[target])).rows[0];
   if(!existing)throw new Error('NOT_FOUND');
   if((await client.query("SELECT 1 FROM juyu.role_enrollments WHERE member_id=$1 AND state='pending'",[target])).rowCount)throw new Error('MEMBER_PENDING');
   // Disabling access may target an account whose company membership has already expired.
   const eligible=change.type==='disable'&&change.disabled?null:await this.provider.verified(target);
   if(!(change.type==='disable'&&change.disabled)&&!eligible)throw new Error('FORBIDDEN: target company verification');
   if(change.type==='role'&&existing.disabled_at)throw new Error('FORBIDDEN: restore target first');
   const user=await this.provider.user(target);if(user.id!==target)throw new Error('FORBIDDEN: target mismatch');
   const before=parseRole(user.publicMetadata?.role);
   if(change.type==='role'&&before!==change.expectedRole)throw new Error('CONFLICT');
   if(change.type==='role'&&before===change.role)throw new Error('NO_CHANGE');
   const op=(await client.query(`INSERT INTO juyu.member_operations(actor_id,target_id,kind,before_role,requested_role,requested_disabled,before_disabled)
     VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[actor.id,target,change.type,before,change.type==='role'?change.role:null,change.type==='disable'?change.disabled:null,Boolean(existing.disabled_at)])).rows[0] as Operation;
   if(change.type==='disable')return this.finish(client,op,before,null);
   try{
    await this.provider.setRole(target,change.role);
    const observed=await this.provider.user(target);if(observed.id!==target)throw new Error('IDENTITY_MISMATCH');
    return await this.finish(client,op,parseRole(observed.publicMetadata?.role),null);
   }catch{
    // Intent is committed before the remote write. Never guess whether a timed-out write applied.
    return op;
   }
  });
 }
 async reconcile(id:string):Promise<Operation>{
  if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error('INVALID_INPUT');
  return this.store.locked(async client=>{
   const actor=await this.actor(client);
   const op=(await client.query('SELECT * FROM juyu.member_operations WHERE id=$1',[id])).rows[0] as Operation|undefined;
   if(!op)throw new Error('NOT_FOUND');if(op.status!=='pending')return op;
   if(op.kind==='disable')return this.finish(client,op,op.before_role,actor.id);
   const user=await this.provider.user(op.target_id);if(user.id!==op.target_id)throw new Error('FORBIDDEN: target mismatch');
   const observed=parseRole(user.publicMetadata?.role);
   // A failed transport can still be executing remotely. A nonmatching read is not a cancellation.
   if(observed!==op.requested_role)return op;
   return this.finish(client,op,observed,actor.id);
  });
 }
 private async finish(client:PoolClient,op:Operation,role:Role|null,reconciler:string|null):Promise<Operation>{
  await client.query('BEGIN');
  try{
   if(op.kind==='disable')await client.query('UPDATE juyu.members SET disabled_at=CASE WHEN $2 THEN clock_timestamp() ELSE NULL END WHERE clerk_user_id=$1',[op.target_id,op.requested_disabled]);
   else await client.query('UPDATE juyu.members SET observed_role=$2,observed_at=clock_timestamp() WHERE clerk_user_id=$1',[op.target_id,role]);
   const result=(await client.query("UPDATE juyu.member_operations SET status=$2,observed_role=$3,finished_at=clock_timestamp(),reconciled_by=$4 WHERE id=$1 AND status='pending' RETURNING *",[op.id,op.kind==='disable'||role===op.requested_role?'applied':'conflict',role,reconciler])).rows[0];
   await client.query('COMMIT');return result;
  }catch(error){await client.query('ROLLBACK');throw error;}
 }
}
