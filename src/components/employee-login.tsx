"use client";
import { ClerkFailed, ClerkLoaded, ClerkLoading, SignIn } from '@clerk/nextjs';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useState} from 'react';
import { loginFlow, type LoginAudience } from '../authentication/login-flow';

export function EmployeeLogin({ audience = 'employee' }: { audience?: LoginAudience }) {
  const flow = loginFlow(audience);
  const pathname=usePathname();
  const [email,setEmail]=useState(false);
  const initial=pathname===flow.signIn||pathname===flow.signIn+'/';
  return <div className={`clerk-login login-auth ${initial?'login-auth--initial':''} ${initial&&!email?'login-auth--social':''}`}>
    <ClerkLoading><p role="status">正在连接登录服务…</p><Link className="back-link" href={flow.error}>连接遇到问题</Link></ClerkLoading>
    <ClerkFailed><p role="alert">登录服务暂时无法连接，请稍后重试。</p><Link className="secondary-link" href={flow.error}>查看重试方式</Link></ClerkFailed>
    <ClerkLoaded><SignIn routing="path" path={flow.signIn} forceRedirectUrl={flow.afterSignIn} signUpForceRedirectUrl={flow.afterSignIn} withSignUp={false} appearance={{variables:{colorPrimary:audience==='admin'?'#ffffff':'#cf2337',colorPrimaryForeground:audience==='admin'?'#151619':'#ffffff',colorBackground:audience==='admin'?'#111214':'#f8f7f4',colorForeground:audience==='admin'?'#f8f8f8':'#191a1e',colorMutedForeground:audience==='admin'?'#b6b7bd':'#65666d',borderRadius:'10px'},elements:{rootBox:{width:'100%'},cardBox:{width:'100%',boxShadow:'none',border:0},card:{padding:'0',boxShadow:'none',background:'transparent'},socialButtonsBlockButton:{minHeight:'68px'},socialButtonsBlockButtonText:{fontSize:'18px'},formButtonPrimary:{minHeight:'48px'}}}} />{initial&&<button type="button" className="login-email-toggle" aria-expanded={email} onClick={()=>setEmail(!email)}>{email?'收起邮箱登录':'使用邮箱登录 →'}</button>}</ClerkLoaded>
  </div>;
}
