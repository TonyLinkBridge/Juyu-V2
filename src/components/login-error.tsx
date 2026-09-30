import { EmployeeSignOut } from './employee-sign-out';
import { clerkConfiguration } from '../config/clerk';
import { EntryShell } from './entry-shell';
import { loginFlow, type LoginAudience } from '../authentication/login-flow';
export function LoginError({ audience = 'employee' }: { audience?: LoginAudience }) {
  return <EntryShell><main id="main-content" className="access-main"><section className="access-card">
    <p className="card-kicker">{audience === 'admin' ? 'CONTENT WORKSPACE' : 'TEAM KNOWLEDGE'}</p><h1>登录遇到问题</h1>
    <p className="access-description">暂时无法确认登录状态，请检查网络后重新尝试。如果问题持续，请联系管理员。</p>
    {clerkConfiguration(process.env) === 'configured' && <div className="login-recovery-exit">
      <EmployeeSignOut audience={audience} recovery />
      <p className="access-policy">如果重试后仍回到此页，可以先退出，再重新登录。此操作不会退出 Slack。</p>
    </div>}
    {/* Full document reload retries a failed Clerk script/provider. */}
    <a className="primary-link" href={loginFlow(audience).signIn}>重新尝试登录</a>
    <details className="login-recovery-help"><summary>仍然无法退出？</summary><p className="access-policy">恢复网络后重试。如果登录服务一直无法连接，可在浏览器的网站设置中，仅清除本站的 Cookie 和网站数据，然后重新打开登录页。清除网站数据会移除本机未同步的草稿副本，已保存到服务器的文章不会删除。</p></details>
  </section></main></EntryShell>;
}
