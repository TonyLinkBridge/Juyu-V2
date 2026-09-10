import { enrollmentRedirect } from '../../../../server/enrollment/navigation';
import { applicationEnrollment } from '../../../../server/enrollment/application';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import {LoginScreen} from '../../../../components/login-screen';
import { EmployeeLogin } from '../../../../components/employee-login';
import { EmployeeSignOut } from '../../../../components/employee-sign-out';
import { employeeSession } from '../../../../server/authentication/clerk';
import { currentAdminAccess } from '../../../../server/authentication/admin-entry';
import { adminDestination } from '../../../../server/authentication/admin';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '管理员登录' };
export default async function AdminSignIn() {
  const session = await employeeSession();
  if (session.status === 'unconfigured') return <LoginScreen audience="admin"><div className="login-unavailable" role="status"><p>登录服务尚未连接</p><p>资料库暂未开放，请等待管理员完成开通。</p></div></LoginScreen>;
  if (session.status === 'unavailable') redirect('/admin/sign-in/error');
  let pending = false;
  if (session.status === 'signed_in') {
    const opening=await enrollmentRedirect(async()=>(await applicationEnrollment()).inspect());
    if(opening)redirect(opening);
    const access = await currentAdminAccess();
    if (access.status === 'unconfigured') pending = true;
    else if (access.status !== 'signed_out') redirect(adminDestination(access));
  }
  return <LoginScreen audience="admin">{pending ? <><p role="status" className="connection-notice">公司账号验证尚未配置，请等待完成开通。</p><EmployeeSignOut audience="admin" /></> : <EmployeeLogin audience="admin" />}</LoginScreen>;
}
