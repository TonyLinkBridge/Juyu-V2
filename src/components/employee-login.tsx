"use client";
import {ClerkFailed, ClerkLoaded, ClerkLoading, SignIn} from '@clerk/nextjs';
import {ArrowRight, ChevronUp, Mail} from 'lucide-react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useId, useState} from 'react';
import {loginFlow, type LoginAudience} from '../authentication/login-flow';

export function EmployeeLogin({audience='employee'}:{audience?:LoginAudience}) {
  const flow=loginFlow(audience);
  const pathname=usePathname();
  const [email,setEmail]=useState(false);
  const formId=useId();
  const initial=pathname===flow.signIn||pathname===flow.signIn+'/';
  return <div className={`clerk-login login-auth ${initial?'login-auth--initial':''} ${initial&&!email?'login-auth--social':''}`}>
    <ClerkLoading><p role="status" className="login-service-notice">正在连接登录服务…</p><Link className="login-service-link" href={flow.error}>连接遇到问题</Link></ClerkLoading>
    <ClerkFailed><p role="alert" className="login-service-notice">登录服务暂时无法连接，请稍后重试。</p><Link className="login-service-link" href={flow.error}>查看重试方式</Link></ClerkFailed>
    <ClerkLoaded>
      <div id={formId}>
        <SignIn routing="path" path={flow.signIn} forceRedirectUrl={flow.afterSignIn} signUpForceRedirectUrl={flow.afterSignIn} withSignUp={false}
          appearance={{variables:{colorPrimary:'#c81630',colorPrimaryForeground:'#ffffff',colorBackground:'var(--login-bg)',colorForeground:'var(--login-fg)',colorMutedForeground:'var(--login-muted)',borderRadius:'12px'},elements:{rootBox:{width:'100%'},cardBox:{width:'100%',boxShadow:'none',border:0,overflow:'visible',background:'transparent'},card:{padding:0,boxShadow:'none',background:'transparent'},socialButtonsBlockButton:{minHeight:'60px'},socialButtonsBlockButtonText:{fontSize:'16px'},formButtonPrimary:{minHeight:'46px'}}}}/>
      </div>
      {initial&&<>
        <p className="login-slack-help">使用公司 Slack 账号继续</p>
        <div className="login-divider" aria-hidden="true"><span/><span>或</span><span/></div>
        <button type="button" className="login-email-toggle" aria-expanded={email} aria-controls={formId} onClick={()=>setEmail(!email)}>
          <Mail size={17} aria-hidden="true"/>{email?'收起邮箱登录':'使用邮箱登录'}{email?<ChevronUp size={16} aria-hidden="true"/>:<ArrowRight size={16} aria-hidden="true"/>}
        </button>
      </>}
    </ClerkLoaded>
  </div>;
}
