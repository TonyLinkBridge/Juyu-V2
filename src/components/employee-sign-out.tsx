"use client";
import {notify} from './feedback/feedback';
import {clearDeviceRecovery} from '../editor/local-recovery';
import {requestReviewLeave,resetReviewLeave} from '../review/leave';
import { useState } from 'react';
import type { LoginAudience } from '../authentication/login-flow';
import { ClerkFailed, ClerkLoading, useClerk, useSession } from '@clerk/nextjs';
import { signOutCurrentSession } from '../authentication/sign-out';
import {clearRecentSearch} from '../reader/recent-search';

export function EmployeeSignOut({ audience = 'employee', locale='zh-CN' }: { audience?: LoginAudience; locale?:'zh-CN'|'en' }) {
  const clerk = useClerk();
  const { session, isLoaded } = useSession();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  async function exit() {
    if (!session || pending) return;
    setPending(true); setFailed(false);
    if (!(await requestReviewLeave('signout'))) {setPending(false); return;}
    try {try{clearDeviceRecovery(localStorage);}catch{notify(locale==='en'?'The local recovery copy could not be cleared. Clear this site’s data in your browser settings.':'本机副本未能清除，请在浏览器设置中清除本站数据。','error');}try{clearRecentSearch(sessionStorage,'zh-CN');clearRecentSearch(sessionStorage,'en');}catch{}dispatchEvent(new Event('juyu-clear-recovery')); await signOutCurrentSession(options => clerk.signOut(options), session.id, audience); }
    catch { resetReviewLeave(); setFailed(true); setPending(false); }
  }
  return <div className="session-exit">
    <ClerkLoading><p role="status">{locale==='en'?'Checking your session…':'正在确认登录状态…'}</p></ClerkLoading>
    <ClerkFailed><p role="alert">{locale==='en'?'The sign-in service is unavailable, so sign-out cannot be confirmed. Restore your connection and reopen this page.':'登录服务无法连接，暂时无法确认退出。请恢复网络后重新打开此页。'}</p></ClerkFailed>
    <button type="button" className="secondary-link" disabled={!isLoaded || !session || pending} onClick={exit}>{locale==='en'?(pending?'Signing out…':'Sign out'):(pending ? '正在退出…' : '退出登录')}</button>
    {failed && <p role="alert">{locale==='en'?'Sign-out was not confirmed. Check your connection and try again.':'退出未成功，请检查网络后重试。当前登录尚未确认退出。'}</p>}
  </div>;
}
