'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {ClerkFailed,useClerk,useUser} from '@clerk/nextjs';
import Link from 'next/link';
/* eslint-disable @next/next/no-img-element -- Same local source-brand SVG used in the reference header. */
import {ThemeToggler} from '../gitbook/ThemeToggler/ThemeToggler';
import {EmployeeSignOut} from '../employee-sign-out';

function Popover({label,children,className='',locale='zh-CN'}:{label:ReactNode;children:ReactNode;className?:string;locale?:'zh-CN'|'en'}){
 const ref=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{
  const outside=(event:PointerEvent)=>{if(ref.current&&!ref.current.contains(event.target as Node))ref.current.open=false;};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&ref.current?.open){ref.current.open=false;ref.current.querySelector('summary')?.focus();}};
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
 },[]);
 return <details ref={ref} className={`account-menu ${className}`}><summary>{label}</summary><div><div className="mobile-account-appearance"><p>{locale==='en'?'Appearance':'外观主题'}</p><ThemeToggler compact locale={locale}/></div>{children}</div></details>;
}
function AdminShortcut({locale='zh-CN'}:{locale?:'zh-CN'|'en'}){const label=locale==='en'?'Admin console':'管理后台';return <Link prefetch={false} className="admin-console-button" href="/admin" aria-label={label}><img className="admin-console-icon" src="/brand/juyu-icon.svg" alt="" width={19} height={19}/><span>{label}</span><b aria-hidden="true">↗</b></Link>;}
function AccountIdentity({name,role,locale='zh-CN'}:{name:string;role:string;locale?:'zh-CN'|'en'}){return <><span className="account-avatar" aria-hidden="true">{Array.from(name).slice(0,2).join('').toUpperCase()}</span><span className="account-identity"><strong>{name}</strong><span>{role} · {locale==='en'?'Account access':'账号权限'}</span></span><span className="account-chevron" aria-hidden="true">⌄</span></>;}
function LocaleSwitch({locale}:{locale:'zh-CN'|'en'}){return <nav className="reader-locale-switch" aria-label={locale==='en'?'Help Centre language':'资料库语言'}><Link href="/help-centre" aria-current={locale==='zh-CN'?'page':undefined}>中文</Link><Link href="/help-centre?lang=en" aria-current={locale==='en'?'page':undefined}>EN</Link></nav>;}
export function AccountMenu({admin=false,enabled=false,locale='zh-CN'}:{admin?:boolean;enabled?:boolean;locale?:'zh-CN'|'en'}){
 const preview=usePathname().startsWith('/design-preview/');
 return <div className="account-controls">{!admin&&<LocaleSwitch locale={locale}/>}<ThemeToggler compact locale={locale}/>{preview?<>{!admin&&<AdminShortcut locale={locale}/>}<Popover locale={locale} label={<AccountIdentity name="tony" role="Admin" locale={locale}/>}>{!admin&&<div className="mobile-account-shortcut"><AdminShortcut locale={locale}/></div>}<strong>{locale==='en'?'Demo account':'示例账号'}</strong><p>{locale==='en'?'For interface previews only. This is not a real signed-in identity.':'仅用于界面预览，未代表任何真实登录身份。'}</p><p>{locale==='en'?'After signing in, you can view your name, email and role, manage your account, or sign out.':'正式登录后可查看姓名、邮箱和角色，并管理账号或退出。'}</p></Popover></>:enabled?<SignedInAccount admin={admin} locale={locale}/>:<Popover locale={locale} label={<AccountIdentity name={locale==='en'?'Account':'账号'} role={locale==='en'?'Signed out':'未登录'} locale={locale}/>}><p>{locale==='en'?'Account controls are unavailable because sign-in is not configured.':'登录服务尚未配置，账号操作暂不可用。'}</p></Popover>}</div>;
}
function SignedInAccount({admin,locale}:{admin:boolean;locale:'zh-CN'|'en'}){
 const {user,isLoaded,isSignedIn}=useUser();const clerk=useClerk();const [failed,setFailed]=useState(false);
 const name=user?.fullName||user?.username||user?.primaryEmailAddress?.emailAddress||'账号';
 const role=user?.publicMetadata.role;
 const administrator=role==='admin'||role==='super_admin';
 const roleLabel=role==='super_admin'?'超级管理员':role==='admin'?'管理员':role==='ops'?'运营':role==='support'?'客服':'权限待确认';
 const localizedRole=locale==='en'?(role==='super_admin'?'Super Admin':role==='admin'?'Admin':role==='ops'?'Ops':role==='support'?'Support':'Access pending'):roleLabel;
 return <>{!admin&&isLoaded&&isSignedIn&&administrator&&<AdminShortcut locale={locale}/>}<Popover locale={locale} label={<AccountIdentity name={isLoaded&&isSignedIn?name:(locale==='en'?'Account':'账号')} role={isLoaded&&isSignedIn?localizedRole:!isLoaded?(locale==='en'?'Checking…':'正在确认…'):(locale==='en'?'Signed out':'未登录')} locale={locale}/>}>
  <ClerkFailed><p role="alert">{locale==='en'?'The sign-in service is unavailable. Restore your connection and try again.':'登录服务无法连接，请恢复网络后重试。'}</p></ClerkFailed>
  {!isLoaded?<p role="status">{locale==='en'?'Loading account…':'正在读取账号…'}</p>:!isSignedIn?<p>{locale==='en'?'You are signed out.':'当前未登录。'}</p>:<>{!admin&&administrator&&<div className="mobile-account-shortcut"><AdminShortcut locale={locale}/></div>}<strong>{name}</strong><p className="account-email">{user.primaryEmailAddress?.emailAddress||(locale==='en'?'No email address':'未设置邮箱')}</p><p className="account-role">{localizedRole}</p><button className="account-settings-button" onClick={()=>{setFailed(false);try{clerk.openUserProfile();}catch{setFailed(true);}}}>{locale==='en'?'Account settings':'账号设置'}</button>{failed&&<p role="alert">{locale==='en'?'Account settings could not be opened. Try again.':'账号设置暂时无法打开，请重试。'}</p>}<EmployeeSignOut audience={admin?'admin':'employee'} locale={locale}/></>}
 </Popover></>;
}
