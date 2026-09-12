"use client";
import {notify} from './feedback/feedback';
import {clearDeviceRecovery} from '../editor/local-recovery';
import {requestReviewLeave,resetReviewLeave} from '../review/leave';
import { useState } from 'react';
import type { LoginAudience } from '../authentication/login-flow';
import { ClerkFailed, ClerkLoading, useClerk, useSession } from '@clerk/nextjs';
import { signOutCurrentSession } from '../authentication/sign-out';

export function EmployeeSignOut({ audience = 'employee' }: { audience?: LoginAudience }) {
  const clerk = useClerk();
  const { session, isLoaded } = useSession();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  async function exit() {
    if (!session || pending) return;
    setPending(true); setFailed(false);
    if (!(await requestReviewLeave('signout'))) {setPending(false); return;}
    try {try{clearDeviceRecovery(localStorage);}catch{notify('本机副本未能清除，请在浏览器设置中清除本站数据。','error');} dispatchEvent(new Event('juyu-clear-recovery')); await signOutCurrentSession(options => clerk.signOut(options), session.id, audience); }
    catch { resetReviewLeave(); setFailed(true); setPending(false); }
  }
  return <div className="session-exit">
    <ClerkLoading><p role="status">正在确认登录状态…</p></ClerkLoading>
    <ClerkFailed><p role="alert">登录服务无法连接，暂时无法确认退出。请恢复网络后重新打开此页。</p></ClerkFailed>
    <button type="button" className="secondary-link" disabled={!isLoaded || !session || pending} onClick={exit}>{pending ? '正在退出…' : '退出登录'}</button>
    {failed && <p role="alert">退出未成功，请检查网络后重试。当前登录尚未确认退出。</p>}
  </div>;
}
