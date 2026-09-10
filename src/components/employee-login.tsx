"use client";
import { ClerkFailed, ClerkLoaded, ClerkLoading, SignIn } from '@clerk/nextjs';
import Link from 'next/link';
import { loginFlow, type LoginAudience } from '../authentication/login-flow';

export function EmployeeLogin({ audience = 'employee' }: { audience?: LoginAudience }) {
  const flow = loginFlow(audience);
  return <div className="clerk-login">
    <ClerkLoading><p role="status">正在连接登录服务…</p><Link className="back-link" href={flow.error}>连接遇到问题</Link></ClerkLoading>
    <ClerkFailed><p role="alert">登录服务暂时无法连接，请稍后重试。</p><Link className="secondary-link" href={flow.error}>查看重试方式</Link></ClerkFailed>
    <ClerkLoaded><SignIn routing="path" path={flow.signIn} forceRedirectUrl={flow.afterSignIn} signUpForceRedirectUrl={flow.afterSignIn} withSignUp={false} appearance={{ elements: { rootBox: { width: '100%' }, cardBox: { width: '100%', boxShadow: 'none' }, card: { padding: '20px 0', boxShadow: 'none' } } }} /></ClerkLoaded>
  </div>;
}
