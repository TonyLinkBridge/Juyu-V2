/* eslint-disable @next/next/no-img-element -- Static local brand assets are precompressed and do not use the private-media optimizer. */
import Link from 'next/link';
import {ArrowRight, LockKeyhole} from 'lucide-react';
import {ThemeSwitch} from 'fumadocs-ui/layouts/shared/slots/theme-switch';
import type {ReactNode} from 'react';
import {loginFlow, type LoginAudience} from '../authentication/login-flow';
import {LoginAtmosphere} from './login-atmosphere';

export function LoginScreen({audience='employee',children}:{audience?:LoginAudience;children:ReactNode}) {
  const admin=audience==='admin';
  return <div className="login-screen" data-login-audience={audience}>
    <a className="skip-link" href="#main-content">跳到登录</a>
    <LoginAtmosphere/>
    <div className="login-horizon" aria-hidden="true"><div/><div/></div>
    <header className="login-header">
      <Link href="/sign-in" className="login-brand" aria-label="聚域 Help Centre 员工登录入口">
        <img className="login-logo-light" src="/brand/juyu-logo-color.png" alt="聚域" width={139} height={43}/>
        <img className="login-logo-dark" src="/brand/juyu-logo-white.png" alt="聚域" width={139} height={43}/>
        <span>Help Centre</span>
      </Link>
      <Link className="login-switch" href={admin?'/sign-in':'/admin/sign-in'}>
        {admin?'员工资料库':'管理员登录'}<ArrowRight size={15} aria-hidden="true"/>
      </Link>
    </header>
    <main id="main-content" className="login-main">
      <div className="login-composition">
        <div className={`login-art${admin?' login-art--admin':''}`} aria-hidden="true">
          <img src={`/brand/mascot-${audience}.webp`} alt="" width={admin?1254:1156} height={admin?1254:1360} draggable={false}/>
        </div>
        <section className="login-copy" aria-labelledby="login-title">
          <p className="login-eyebrow">{admin?'JUYU ADMIN':'JUYU KNOWLEDGE BASE'}</p>
          <h1 id="login-title">{admin?'登录内容管理后台':'登录聚域资料库'}</h1>
          <p className="login-description">{admin?'编辑、审核与发布团队资料。':'查阅团队知识、业务流程与速查资料。'}</p>
          {children}
          <p className="login-access-note"><LockKeyhole size={13} aria-hidden="true"/>{admin?'仅限具有管理权限的公司成员':'仅限经授权的公司成员访问'}</p>
          <Link className="login-help-link" href={loginFlow(audience).error}>登录遇到问题？</Link>
        </section>
      </div>
    </main>
    <footer className="login-footer">
      <div><p>JUYU · 为团队保存可靠的答案</p><span>团队知识，随时找到。</span></div>
      <ThemeSwitch mode="light-dark-system" className="login-theme-switch"/>
    </footer>
  </div>;
}
