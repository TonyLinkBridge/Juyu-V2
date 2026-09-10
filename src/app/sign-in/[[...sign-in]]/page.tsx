import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AccessUnavailable } from '../../../components/access-unavailable';
import { BookIcon, EntryShell } from '../../../components/entry-shell';
import { EmployeeLogin } from '../../../components/employee-login';
import { employeeSession } from '../../../server/authentication/clerk';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '员工登录' };
export default async function EmployeeSignIn() {
  const session = await employeeSession();
  if (session.status === 'unconfigured') return <AccessUnavailable audience="employee" />;
  if (session.status === 'unavailable') redirect('/sign-in/error');
  if (session.status === 'signed_in') redirect('/help-centre');
  return <EntryShell><main id="main-content" className="access-main"><section className="access-card" aria-labelledby="access-title">
    <div className="entry-icon"><BookIcon /></div><p className="card-kicker">TEAM KNOWLEDGE</p>
    <h1 id="access-title">员工登录</h1><p className="access-description">使用公司账号登录内部资料库。</p>
    <EmployeeLogin /><p className="access-policy">仅限通过公司邮箱和指定 Slack Workspace 验证的账号。</p>
  </section></main></EntryShell>;
}
