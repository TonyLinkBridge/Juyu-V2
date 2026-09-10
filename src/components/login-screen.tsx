/* eslint-disable @next/next/no-img-element -- Local compressed brand artwork, no remote optimizer. */
import Link from 'next/link';
import type {ReactNode} from 'react';
import type {LoginAudience} from '../authentication/login-flow';
export function LoginScreen({audience='employee',children}:{audience?:LoginAudience;children:ReactNode}){
 const admin=audience==='admin';
 return <div className={`login-screen login-screen--${admin?'dark':'light'}`}><a className="skip-link" href="#main-content">跳到登录</a><header className="login-header"><Link href="/sign-in" className="login-brand" aria-label="聚域 Help Centre"><img src={`/brand/juyu-logo-${admin?'white':'color'}.png`} alt="聚域"/><span>Help Centre</span></Link><Link className="login-switch" href={admin?'/sign-in':'/admin/sign-in'}>{admin?'返回员工登录':'管理员登录'} ↗</Link></header><main id="main-content" className="login-main"><section className="login-copy" aria-labelledby="login-title"><h1 id="login-title">{admin?'登录内容管理后台':'登录聚域资料库'}</h1><p className="login-description">{admin?'编辑、审核与发布团队资料。':'查阅团队知识、业务流程与速查资料。'}</p>{children}</section><div className="login-art" aria-hidden="true"><img src={`/brand/login-${admin?'dark':'light'}.webp`} alt="" fetchPriority="low"/></div></main><footer className="login-policy">{admin?'仅限授权管理员访问':'仅限授权的公司成员访问'}</footer></div>;
}
