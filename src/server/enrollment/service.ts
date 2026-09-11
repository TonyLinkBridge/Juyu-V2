import type {PoolClient} from 'pg';
import type {Role} from '../../domain/model.ts';
import {MemberStore} from '../members/store.ts';
import type {EnrollmentCandidate} from './candidate.ts';
export type EnrollmentResult={status:'ready';role:Role;initialAdmin:boolean}|{status:'required'|'pending'|'waiting'};
type Initial={state:'empty'|'pending'|'complete';owner_id:string|null;mode:'automatic'|'existing'|null};
type Intent={member_id:string;requested_role:'admin'|'support';purpose:'bootstrap'|'default';state:'pending'|'complete'};
export class EnrollmentService{
 private store:MemberStore;private authenticate:()=>Promise<EnrollmentCandidate|null>;private provider:{setRole(id:string,role:Role):Promise<void>};
 constructor(store:MemberStore,authenticate:()=>Promise<EnrollmentCandidate|null>,provider:{setRole(id:string,role:Role):Promise<void>}){this.store=store;this.authenticate=authenticate;this.provider=provider;}
 private async context(c:PoolClient){
  const candidate=await this.authenticate();if(!candidate)throw new Error('FORBIDDEN: company verification');
  const row=(await c.query(`SELECT
    (SELECT row_to_json(m) FROM (SELECT disabled_at FROM juyu.members WHERE clerk_user_id=$1) m) AS member,
    EXISTS(SELECT 1 FROM juyu.member_operations WHERE target_id=$1 AND status='pending') AS pending,
    (SELECT row_to_json(i) FROM juyu.initialization i) AS initial,
    (SELECT row_to_json(r) FROM juyu.role_enrollments r WHERE member_id=$1) AS intent`,[candidate.id])).rows[0];
  const member=row.member;
  if(member?.disabled_at)throw new Error('FORBIDDEN: member disabled');
  if(row.pending)throw new Error('MEMBER_PENDING');
  const initial=row.initial as Initial|undefined;if(!initial)throw new Error('AUTH_NOT_CONFIGURED');
  const intent=row.intent as Intent|undefined;
  return {candidate,member,initial,intent};
 }
 async inspect():Promise<EnrollmentResult>{
  return this.store.locked(async c=>{
   const {candidate,member,initial,intent}=await this.context(c);
   if(initial.state==='pending'&&initial.owner_id!==candidate.id)return {status:'waiting'};
   if(intent?.state==='pending')return {status:'pending'};
   if(member&&!candidate.role)throw new Error('FORBIDDEN: existing role removed');
   if(initial.state==='empty'||!member)return {status:'required'};
   if(!candidate.role)throw new Error('FORBIDDEN: missing role');
   return {status:'ready',role:candidate.role,initialAdmin:initial.mode==='automatic'&&initial.owner_id===candidate.id&&candidate.role==='admin'};
  },true);
 }
 async run():Promise<EnrollmentResult>{
  return this.store.locked(async c=>{
   const context=await this.context(c),{candidate,member,intent}=context;let {initial}=context;
   if(initial.state==='pending'&&initial.owner_id!==candidate.id)return {status:'waiting'};
   if(intent?.state==='pending')return this.confirm(c,candidate,intent,initial);
   if(member&&!candidate.role)throw new Error('FORBIDDEN: existing role removed');
   if((await c.query("SELECT 1 FROM juyu.member_operations WHERE status='pending'")).rowCount)throw new Error('MEMBER_PENDING');
   // Preserve manually configured roles or members brought from an existing system.
   if(initial.state==='empty'&&(candidate.role||(await c.query('SELECT 1 FROM juyu.members LIMIT 1')).rowCount)){
    await c.query("UPDATE juyu.initialization SET state='complete',mode='existing',completed_at=clock_timestamp() WHERE singleton=true");
    initial={state:'complete',mode:'existing',owner_id:null};
   }
   if(candidate.role){await this.store.bind({...candidate,role:candidate.role},c);return {status:'ready',role:candidate.role,initialAdmin:initial.mode==='automatic'&&initial.owner_id===candidate.id&&candidate.role==='admin'};}
   const role=initial.state==='empty'?'admin':'support',purpose=role==='admin'?'bootstrap':'default';
   // Commit ownership and intent before any remote side effect. Never retry a recorded intent.
   await c.query('BEGIN');
   try{
    await c.query('INSERT INTO juyu.members(clerk_user_id,display_name,verified_email) VALUES($1,$2,$3)',[candidate.id,candidate.displayName,candidate.email]);
    await c.query('INSERT INTO juyu.role_enrollments(member_id,requested_role,purpose) VALUES($1,$2,$3)',[candidate.id,role,purpose]);
    if(role==='admin')await c.query("UPDATE juyu.initialization SET state='pending',owner_id=$1,mode='automatic' WHERE singleton=true AND state='empty'",[candidate.id]);
    await c.query('COMMIT');
   }catch(error){await c.query('ROLLBACK');throw error;}
   const pending:Intent={member_id:candidate.id,requested_role:role,purpose,state:'pending'};
   try{
    await this.provider.setRole(candidate.id,role);
    const current=await this.authenticate();if(!current||current.id!==candidate.id)return {status:'pending'};
    return await this.confirm(c,current,pending,role==='admin'?{state:'pending',owner_id:candidate.id,mode:'automatic'}:initial);
   }catch{return {status:'pending'};}
  });
 }
 private async confirm(c:PoolClient,candidate:EnrollmentCandidate,intent:Intent,initial:Initial):Promise<EnrollmentResult>{
  if(candidate.role!==intent.requested_role)return {status:'pending'};
  await c.query('BEGIN');
  try{
   await c.query("UPDATE juyu.role_enrollments SET state='complete',confirmed_at=clock_timestamp() WHERE member_id=$1 AND state='pending'",[candidate.id]);
   if(intent.purpose==='bootstrap')await c.query("UPDATE juyu.initialization SET state='complete',completed_at=clock_timestamp() WHERE state='pending' AND owner_id=$1",[candidate.id]);
   await this.store.bind({...candidate,role:candidate.role},c);
   await c.query('COMMIT');
  }catch(error){await c.query('ROLLBACK');throw error;}
  return {status:'ready',role:candidate.role,initialAdmin:intent.purpose==='bootstrap'||(initial.mode==='automatic'&&initial.owner_id===candidate.id)};
 }
}
