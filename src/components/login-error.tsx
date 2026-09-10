import { EntryShell } from './entry-shell';
import { loginFlow, type LoginAudience } from '../authentication/login-flow';
export function LoginError({ audience = 'employee' }: { audience?: LoginAudience }) {
  return <EntryShell><main id="main-content" className="access-main"><section className="access-card">
    <p className="card-kicker">{audience === 'admin' ? 'CONTENT WORKSPACE' : 'TEAM KNOWLEDGE'}</p><h1>登录遇到问题</h1>
    <p className="access-description">暂时无法确认登录状态，请检查网络后重新尝试。如果问题持续，请联系管理员。</p>
    {/* Full document reload retries a failed Clerk script/provider. */}
    <a className="primary-link" href={loginFlow(audience).signIn}>重新尝试登录</a>
  </section></main></EntryShell>;
}
