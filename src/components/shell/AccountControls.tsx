'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {ClerkFailed,useClerk,useUser} from '@clerk/nextjs';
import Link from 'next/link';
/* eslint-disable @next/next/no-img-element -- Same local source-brand SVG used in the reference header. */
import {ThemeToggler} from '../gitbook/ThemeToggler/ThemeToggler';
import {EmployeeSignOut} from '../employee-sign-out';

function Popover({label,children,className=''}:{label:ReactNode;children:ReactNode;className?:string}){
 const ref=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{
  const outside=(event:PointerEvent)=>{if(ref.current&&!ref.current.contains(event.target as Node))ref.current.open=false;};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&ref.current?.open){ref.current.open=false;ref.current.querySelector('summary')?.focus();}};
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
 },[]);
 return <details ref={ref} className={`account-menu ${className}`}><summary>{label}</summary><div>{children}</div></details>;
}
function AdminShortcut(){return <Link prefetch={false} className="admin-console-button" href="/admin" aria-label="管理后台"><img className="admin-console-icon" src="/brand/juyu-icon.svg" alt="" width={19} height={19}/><span>管理后台</span><b aria-hidden="true">↗</b></Link>;}
function AccountIdentity({name,role}:{name:string;role:string}){return <><span className="account-avatar" aria-hidden="true">{Array.from(name).slice(0,2).join('').toUpperCase()}</span><span className="account-identity"><strong>{name}</strong><span>{role} · 账号权限</span></span><span className="account-chevron" aria-hidden="true">⌄</span></>;}
export function AccountMenu({admin=false,enabled=false}:{admin?:boolean;enabled?:boolean}){
 const preview=usePathname().startsWith('/design-preview/');
 return <div className="account-controls"><ThemeToggler compact/>{preview?<>{!admin&&<AdminShortcut/>}<Popover label={<AccountIdentity name="tony" role="Admin"/>}><strong>示例账号</strong><p>仅用于界面预览，未代表任何真实登录身份。</p><p>正式登录后可查看姓名、邮箱和角色，并管理账号或退出。</p></Popover></>:enabled?<SignedInAccount admin={admin}/>:<Popover label={<AccountIdentity name="账号" role="未登录"/>}><p>登录服务尚未配置，账号操作暂不可用。</p></Popover>}</div>;
}
function SignedInAccount({admin}:{admin:boolean}){
 const {user,isLoaded,isSignedIn}=useUser();const clerk=useClerk();const [failed,setFailed]=useState(false);
 const name=user?.fullName||user?.username||user?.primaryEmailAddress?.emailAddress||'账号';
 const role=user?.publicMetadata.role;
 const roleLabel=role==='admin'?'管理员':role==='ops'?'运营':role==='support'?'客服':'权限待确认';
 return <>{!admin&&isLoaded&&isSignedIn&&role==='admin'&&<AdminShortcut/>}<Popover label={<AccountIdentity name={isLoaded&&isSignedIn?name:'账号'} role={isLoaded&&isSignedIn?(role==='admin'?'Admin':role==='ops'?'Ops':role==='support'?'Support':roleLabel):'未登录'}/>}>
  <ClerkFailed><p role="alert">登录服务无法连接，请恢复网络后重试。</p></ClerkFailed>
  {!isLoaded?<p role="status">正在读取账号…</p>:!isSignedIn?<p>当前未登录。</p>:<><strong>{name}</strong><p className="account-email">{user.primaryEmailAddress?.emailAddress||'未设置邮箱'}</p><p className="account-role">{roleLabel}</p><button className="account-settings-button" onClick={()=>{setFailed(false);try{clerk.openUserProfile();}catch{setFailed(true);}}}>账号设置</button>{failed&&<p role="alert">账号设置暂时无法打开，请重试。</p>}<EmployeeSignOut audience={admin?'admin':'employee'}/></>}
 </Popover></>;
}
