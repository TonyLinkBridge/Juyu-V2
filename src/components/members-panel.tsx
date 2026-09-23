'use client';
import { useState } from 'react';
import type { MemberList, MemberRow } from '../server/members/service';
import type { MemberChange } from '../server/members/input';
import type { Role } from '../domain/model';
const labels:Record<Role,string>={support:'Support · 客服',ops:'Ops · 运营',admin:'Admin · 管理员',super_admin:'Super Admin · 超级管理员'};
const assignableRoles=['support','ops','admin'] as const;
const errors:Record<string,string>={NO_CHANGE:'角色没有变化，无需提交。',FORBIDDEN:'你或目标成员的访问权限已变化，请刷新后核对。',SELF_CHANGE:'不能修改自己的角色或停用自己，请由另一位管理员操作。',CONFLICT:'角色已被其他管理员修改，请刷新后重新选择。',MEMBER_BUSY:'另一项成员操作正在执行，请稍后重试。',MEMBER_PENDING:'有权限修改或账号开通尚未完成，请刷新查看对应成员状态。',AUTH_NOT_CONFIGURED:'成员服务尚未连接。',SERVICE_UNAVAILABLE:'成员服务暂时不可用，请稍后重试。'};
export function MembersPanel({initial}:{initial:MemberList}){
 const [data,setData]=useState(initial),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [confirmation,setConfirmation]=useState<{member:MemberRow;change:MemberChange}|null>(null);
 async function refresh(after=''){
  const response=await fetch('/api/admin/members'+(after?'?after='+encodeURIComponent(after):''),{cache:'no-store'});
  const result=await response.json();if(!response.ok)throw new Error(result.error);setData(result);
 }
 async function perform(path:string,method:string,body:unknown){
  setBusy(true);setMessage('');
  try{
   const response=await fetch(path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),result=await response.json();
   if(!response.ok)throw new Error(result.error);
   setConfirmation(null);
   setMessage(result.status==='pending'?'修改结果暂时无法确认，该成员访问已暂停。请在操作历史中核对。':result.status==='conflict'?'Clerk 当前角色与提交目标不同，已记录实际结果。':'操作已完成并记录。');
   try{await refresh();}catch{setMessage('操作已有返回，但列表刷新失败。请刷新页面核对操作历史后再操作。');}
  }catch(error){setMessage(errors[error instanceof Error?error.message:'']??'暂时无法确认操作结果，请刷新操作历史后核对。');}
  finally{setBusy(false);}
 }
 async function load(after=''){setBusy(true);setMessage('');try{await refresh(after);}catch(error){setMessage(errors[error instanceof Error?error.message:'']??'成员列表暂时无法读取。');}finally{setBusy(false);}}
 const pending=data.operations.some(op=>op.status==='pending');
 return <section aria-label="成员管理">
  <div className="members-toolbar"><span>Support 只读普通资料 · Ops 可读运营资料 · Admin 管理全部</span><button className="secondary-link" disabled={busy} onClick={()=>load()}>刷新成员</button></div>
  <p className="access-policy">停用仅限制这套资料库，不会封禁其他应用中的 Clerk 账号。角色修改会同步到 Clerk。不能修改自己的权限。</p>
  {message&&<p role="status" className="connection-notice">{message}</p>}
  {confirmation&&<div className="member-confirm" role="region" aria-label="确认成员修改">
   <h2>确认修改 {confirmation.member.verified_email}</h2>
   <p>{confirmation.change.type==='role'?`角色将从 ${labels[confirmation.change.expectedRole]} 改为 ${labels[confirmation.change.role]}。`:(confirmation.change.disabled?'该成员将不能再访问资料库。':'该成员通过公司验证后可重新访问资料库。')}</p>
   <button className="primary-link" disabled={busy} onClick={()=>perform('/api/admin/members/'+encodeURIComponent(confirmation.member.clerk_user_id),'PATCH',confirmation.change)}>确认修改</button>
   <button className="secondary-link" disabled={busy} onClick={()=>setConfirmation(null)}>取消</button>
  </div>}
  {pending&&<p className="connection-notice">若反复核对仍未完成，请联系身份服务管理员，先确认原请求已结束，再按记录的目标角色处理并核对。不要自行反复改角色；手动改成相同值不代表原请求已结束。核对完成前，成员修改会暂停。</p>}
  <div className="member-grid">{data.members.map(member=><article className="member-card" key={member.clerk_user_id}>
   <h2>{member.display_name}</h2><p>{member.verified_email}</p><p className="member-state">{member.clerk_user_id===data.actorId?'你 · ':''}{member.enrollment_pending?'等待开通核对':member.pending?'等待核对':member.disabled_at?'已停用':member.providerStatus==='blocked'?'Clerk 账号已受限':member.providerStatus==='unavailable'?'Clerk 暂时无法读取':'已启用'}</p>
   {member.enrollment_pending&&<p className="access-policy">请该成员登录资料库，核对自己的开通申请。若持续未完成，请联系身份服务管理员确认原请求已结束后处理。</p>}
   <label>角色<select aria-label={`${member.verified_email} 的角色`} value={member.role??''} disabled={busy||pending||member.pending||Boolean(member.disabled_at)||member.providerStatus!=='active'||member.clerk_user_id===data.actorId||!member.role} onChange={event=>setConfirmation({member,change:{type:'role',expectedRole:member.role!,role:event.target.value as Role}})}>
    {!member.role&&<option value="">角色未设置或无法读取</option>}{member.role==='super_admin'&&<option value="super_admin">{labels.super_admin}</option>}{assignableRoles.map(value=><option key={value} value={value}>{labels[value]}</option>)}
   </select></label>
   <button className="secondary-link" disabled={busy||pending||member.pending||member.clerk_user_id===data.actorId} onClick={()=>setConfirmation({member,change:{type:'disable',disabled:!member.disabled_at}})}>{member.disabled_at?'恢复访问':'停用访问'}</button>
  </article>)}</div>
  {!data.members.length&&<p className="connection-notice">此页没有成员。</p>}
  {data.nextCursor&&<button className="secondary-link" disabled={busy} onClick={()=>load(data.nextCursor!)}>下一页成员</button>}
  <h2 className="member-history-title">最近操作</h2><p className="access-policy">显示最近 50 项。Clerk 控制台的直接更改不属于应用内操作记录。</p>
  <ol className="member-history">{data.operations.map(op=><li key={op.id}>
   <p><strong>{op.kind==='role'?`角色修改：${op.before_role??'未知'} → ${op.requested_role}`:op.requested_disabled?'停用访问':'恢复访问'}</strong> · {op.status==='pending'?'等待核对':op.status==='applied'?'已完成':'结果与提交不同'}</p>
   <p>成员 {op.target_id} · 操作人 {op.actor_id} · {new Date(op.created_at).toLocaleString('zh-CN')}</p>
   {op.kind==='role'&&op.status!=='pending'&&<p>核对到的角色：{op.observed_role??'未设置或非法角色'}</p>}
   {op.status==='pending'&&<button className="secondary-link" disabled={busy} onClick={()=>perform('/api/admin/members/operations/'+op.id,'POST',{})}>核对结果</button>}
  </li>)}</ol>{!data.operations.length&&<p className="access-policy">还没有应用内成员操作。</p>}
 </section>;
}
