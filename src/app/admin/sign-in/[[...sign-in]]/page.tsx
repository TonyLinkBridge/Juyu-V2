import { enrollmentRedirect } from '../../../../server/enrollment/navigation';
import { applicationEnrollment } from '../../../../server/enrollment/application';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AccessUnavailable } from '../../../../components/access-unavailable';
import { EntryShell, ShieldIcon } from '../../../../components/entry-shell';
import { EmployeeLogin } from '../../../../components/employee-login';
import { EmployeeSignOut } from '../../../../components/employee-sign-out';
import { employeeSession } from '../../../../server/authentication/clerk';
import { currentAdminAccess } from '../../../../server/authentication/admin-entry';
import { adminDestination } from '../../../../server/authentication/admin';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '管理员登录' };
export default async function AdminSignIn() {
  const session = await employeeSession();
  if (session.status === 'unconfigured') return <AccessUnavailable audience="admin" />;
  if (session.status === 'unavailable') redirect('/admin/sign-in/error');
  let pending = false;
  if (session.status === 'signed_in') {
    const opening=await enrollmentRedirect(async()=>(await applicationEnrollment()).inspect());
    if(opening)redirect(opening);
    const access = await currentAdminAccess();
    if (access.status === 'unconfigured') pending = true;
    else if (access.status !== 'signed_out') redirect(adminDestination(access));
  }
  return <EntryShell><main id="main-content" className="access-main"><section className="access-card" aria-labelledby="access-title">
    <div className="entry-icon"><ShieldIcon /></div><p className="card-kicker">CONTENT WORKSPACE</p>
    <h1 id="access-title">管理员登录</h1><p className="access-description">使用公司账号进入内容管理工作台。</p>
    {pending ? <><p role="status" className="connection-notice">公司账号验证尚未配置，请等待完成开通。</p><EmployeeSignOut audience="admin" /></> : <EmployeeLogin audience="admin" />}
    <p className="access-policy">登录后仍需通过公司账号和管理员权限检查。</p>
    <div className="access-switch"><Link href="/sign-in">切换到员工登录 →</Link></div>
  </section></main></EntryShell>;
}
