import Link from 'next/link';
import { BookIcon, EntryShell, ShieldIcon } from './entry-shell';

export function AccessUnavailable({ audience }: { audience: 'employee' | 'admin' }) {
  const admin = audience === 'admin';
  return <EntryShell>
    <main id="main-content" className="access-main">
      <section className="access-card" aria-labelledby="access-title">
        <div className="entry-icon">{admin ? <ShieldIcon /> : <BookIcon />}</div>
        <p className="card-kicker">{admin ? 'CONTENT WORKSPACE' : 'TEAM KNOWLEDGE'}</p>
        <h1 id="access-title">{admin ? '管理员登录' : '员工登录'}</h1>
        <p className="access-description">{admin ? '使用公司账号进入内容管理工作台。' : '使用公司账号，查阅与你的工作相关的正式资料。'}</p>
        <div className="connection-notice" role="status">
          <span className="status-dot" />
          <div><strong>登录服务尚未连接</strong><p>资料库暂未开放，请等待管理员完成开通。</p></div>
        </div>
        <button className="login-unavailable" type="button" disabled>登录暂未开放</button>
        <p className="access-policy">{admin ? '开通后仍需验证管理员权限，普通员工账号不能进入后台。' : '仅限通过公司邮箱和指定 Slack Workspace 验证的账号。'}</p>
        {admin && <div className="access-switch"><Link href="/sign-in">切换到员工登录 <span aria-hidden="true">→</span></Link></div>}
      </section>
    </main>
  </EntryShell>;
}
