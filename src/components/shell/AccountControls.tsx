'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {ClerkFailed,useClerk,useUser} from '@clerk/nextjs';
import {Sun,UserCircle} from '@phosphor-icons/react';
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
export function AccountMenu({admin=false,enabled=false}:{admin?:boolean;enabled?:boolean}){
 const preview=usePathname().startsWith('/design-preview/');
 return <div className="account-controls"><Popover className="appearance-menu" label={<><Sun size={20}/><span className="sr-only">外观设置</span></>}><ThemeToggler/></Popover>{preview?<Popover label={<><UserCircle size={21}/><span className="account-name">示例账号</span> ⌄</>}><strong>示例账号</strong><p>仅用于界面预览，未代表任何真实登录身份。</p><p>正式登录后可查看姓名、邮箱和角色，并管理账号或退出。</p></Popover>:enabled?<SignedInAccount admin={admin}/>:<Popover label={<><UserCircle size={21}/>账号 ⌄</>}><p>登录服务尚未配置，账号操作暂不可用。</p></Popover>}</div>;
}
function SignedInAccount({admin}:{admin:boolean}){
 const {user,isLoaded,isSignedIn}=useUser();const clerk=useClerk();const [failed,setFailed]=useState(false);
 const name=user?.fullName||user?.username||user?.primaryEmailAddress?.emailAddress||'账号';
 const role=user?.publicMetadata.role;
 const roleLabel=role==='admin'?'管理员':role==='ops'?'运营':role==='support'?'客服':'权限待确认';
 return <Popover label={<><UserCircle size={21}/><span className="account-name">{isLoaded&&isSignedIn?name:'账号'}</span> ⌄</>}>
  <ClerkFailed><p role="alert">登录服务无法连接，请恢复网络后重试。</p></ClerkFailed>
  {!isLoaded?<p role="status">正在读取账号…</p>:!isSignedIn?<p>当前未登录。</p>:<><strong>{name}</strong><p className="account-email">{user.primaryEmailAddress?.emailAddress||'未设置邮箱'}</p><p className="account-role">{roleLabel}</p><button className="account-settings-button" onClick={()=>{setFailed(false);try{clerk.openUserProfile();}catch{setFailed(true);}}}>账号设置</button>{failed&&<p role="alert">账号设置暂时无法打开，请重试。</p>}<EmployeeSignOut audience={admin?'admin':'employee'}/></>}
 </Popover>;
}
