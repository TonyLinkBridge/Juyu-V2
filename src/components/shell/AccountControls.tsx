"use client";

import {useState,useRef,type RefObject,type ReactNode} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {ClerkFailed,useClerk,useUser} from '@clerk/nextjs';
import Link from 'next/link';
import {ThemeSwitch} from 'fumadocs-ui/layouts/shared/slots/theme-switch';
import {Settings,ArrowUpRight,BookOpen} from 'lucide-react';
import {UsageGuide,type AdminGuideRole} from '../onboarding/UsageGuide';
import {UserMenu,type UserMenuLabels,type UserMenuItem} from '../ui/user-menu/user-menu';
import {useEmployeeSignOut} from '../employee-sign-out';
import {requestReviewLeave} from '../../review/leave';
/* eslint-disable @next/next/no-img-element -- Existing local JUYU brand asset. */

function AdminShortcut({locale='zh-CN'}:{locale?:'zh-CN'|'en'}){
 const label=locale==='en'?'Admin console':'管理后台';
 return <Link prefetch={false} className="admin-console-button" href="/admin" aria-label={label}><img className="admin-console-icon" src="/brand/juyu-icon.svg" alt="" width={19} height={19}/><span>{label}</span><b aria-hidden="true">↗</b></Link>;
}
function LocaleSwitch({locale}:{locale:'zh-CN'|'en'}){
 return <nav className="reader-locale-switch" aria-label={locale==='en'?'Help Centre language':'资料库语言'}><Link href="/help-centre" aria-current={locale==='zh-CN'?'page':undefined}>中文</Link><Link href="/help-centre?lang=en" aria-current={locale==='en'?'page':undefined}>EN</Link></nav>;
}
const chineseLabels:UserMenuLabels={accountMenu:'账号菜单',theme:'外观',status:'状态',light:'浅色',dark:'深色',system:'跟随系统',signOut:'退出登录',signingOut:'正在退出…',actionError:'操作未成功，请重试。'};
function Menu({locale='zh-CN',...props}:Omit<Parameters<typeof UserMenu>[0],'labels'|'theme'|'onThemeChange'|'showName'>&{locale?:'zh-CN'|'en'}){
 return <UserMenu {...props} showName showTheme={false} labels={locale==='en'?undefined:chineseLabels}/>;
}
export function AccountMenu({admin=false,enabled=false,locale='zh-CN',accountOnly=false,guideRole=null}:{admin?:boolean;enabled?:boolean;locale?:'zh-CN'|'en';accountOnly?:boolean;guideRole?:AdminGuideRole|null}){
 const menuRef=useRef<HTMLDivElement>(null);
 const preview=usePathname().startsWith('/design-preview/');
 return <div ref={menuRef} className="account-controls">{(admin||!accountOnly)&&<ThemeSwitch/>}{!accountOnly&&!admin&&<LocaleSwitch locale={locale}/>}{preview?<Menu locale={locale} user={{name:locale==='en'?'Demo account':'示例账号',email:locale==='en'?'Interface preview only':'仅用于界面预览',plan:locale==='en'?'Preview':'预览'}} notice={<p>{locale==='en'?'This is not a real signed-in identity.':'未代表任何真实登录身份。'}</p>}/>:enabled?<SignedInAccount admin={admin} locale={locale} guideRole={guideRole} menuRef={menuRef}/>:<Menu locale={locale} user={{name:locale==='en'?'Account':'账号',email:locale==='en'?'Sign-in is not configured':'登录服务尚未配置',plan:locale==='en'?'Signed out':'未登录'}}/>}</div>;
}
function SignedInAccount({admin,locale,guideRole,menuRef}:{admin:boolean;locale:'zh-CN'|'en';guideRole:AdminGuideRole|null;menuRef:RefObject<HTMLDivElement|null>}){
 const [guideOpen,setGuideOpen]=useState(false);
 const closeGuide=()=>{setGuideOpen(false);requestAnimationFrame(()=>menuRef.current?.querySelector<HTMLButtonElement>('[aria-haspopup=menu]')?.focus({preventScroll:true}));};
 const {user,isLoaded,isSignedIn}=useUser();const clerk=useClerk();const router=useRouter();
 const signOut=useEmployeeSignOut({audience:admin?'admin':'employee',locale});
 const [profileFailed,setProfileFailed]=useState(false);
 const name=user?.fullName||user?.username||user?.primaryEmailAddress?.emailAddress||(locale==='en'?'Account':'账号');
 const role=user?.publicMetadata.role;
 const administrator=role==='admin'||role==='super_admin';
 const roleLabel=locale==='en'?(role==='super_admin'?'Super Admin':role==='admin'?'Admin':role==='ops'?'Ops':role==='support'?'Support':'Access pending'):(role==='super_admin'?'超级管理员':role==='admin'?'管理员':role==='ops'?'运营':role==='support'?'客服':'权限待确认');
 const ready=isLoaded&&isSignedIn;
 const items:UserMenuItem[]=ready?[{label:locale==='en'?'Account settings':'账号设置',icon:<Settings size={16}/>,onSelect:()=>{setProfileFailed(false);try{clerk.openUserProfile();return true;}catch{setProfileFailed(true);return false;}}}]:[];
 if(ready&&(!admin||guideRole))items.push({label:locale==='en'?'Usage guide':'使用指南',icon:<BookOpen size={16}/>,onSelect:()=>{setGuideOpen(true);return true;}});
 if(ready&&!admin&&administrator)items.push({label:locale==='en'?'Admin console':'管理后台',icon:<ArrowUpRight size={16}/>,onSelect:async()=>{if(!await requestReviewLeave('navigate'))return false;router.push('/admin');return true;}});
 const notice:ReactNode=<><ClerkFailed><p role="alert">{locale==='en'?'The sign-in service is unavailable. Restore your connection and try again.':'登录服务无法连接，请恢复网络后重试。'}</p></ClerkFailed>{!isLoaded?<p role="status">{locale==='en'?'Loading account…':'正在读取账号…'}</p>:!isSignedIn?<p>{locale==='en'?'You are signed out.':'当前未登录。'}</p>:null}{ready&&(!signOut.isLoaded||!signOut.session)&&<p role="status">{locale==='en'?(signOut.isLoaded?'Your current session could not be confirmed. Refresh and try again.':'Checking your session…'):(signOut.isLoaded?'当前登录会话尚未确认，请刷新后重试。':'正在确认登录状态…')}</p>}{profileFailed&&<p role="alert">{locale==='en'?'Account settings could not be opened. Try again.':'账号设置暂时无法打开，请重试。'}</p>}{signOut.failed&&<p role="alert">{locale==='en'?'Sign-out was not confirmed. Check your connection and try again.':'退出未成功，请检查网络后重试。当前登录尚未确认退出。'}</p>}</>;
 return <>{!admin&&ready&&administrator&&<AdminShortcut locale={locale}/>}<Menu locale={locale} user={{name:ready?name:(locale==='en'?'Account':'账号'),email:ready?(user.primaryEmailAddress?.emailAddress||(locale==='en'?'No email address':'未设置邮箱')):'',plan:ready?roleLabel:!isLoaded?(locale==='en'?'Checking…':'正在确认…'):(locale==='en'?'Signed out':'未登录'),avatarSrc:ready?user.imageUrl:undefined}} items={items} onSignOut={ready?signOut.exit:undefined} signOutDisabled={!signOut.isLoaded||!signOut.session} notice={notice}/>{guideOpen&&<UsageGuide admin={admin} adminRole={guideRole} locale={locale} onClose={closeGuide}/>}</>;
}
