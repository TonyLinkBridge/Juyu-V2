import { enrollmentRedirect } from '../../../../server/enrollment/navigation';
import { applicationEnrollment } from '../../../../server/enrollment/application';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import {LoginScreen} from '../../../../components/login-screen';
import { EmployeeLogin } from '../../../../components/employee-login';
import { currentAccountAccess } from '../../../../server/authentication/account-clerk';
import { adminDestination, adminForAccount } from '../../../../server/authentication/admin';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '管理员登录' };
export default async function AdminSignIn() {
  const account = await currentAccountAccess();
  if (account.status === 'unconfigured') return <LoginScreen audience="admin"><div className="login-unavailable" role="status"><p>登录服务尚未连接</p><p>资料库暂未开放，请等待管理员完成开通。</p></div></LoginScreen>;
  if (account.status === 'unavailable') redirect('/admin/sign-in/error');
  if (account.status === 'ready' || account.status === 'disabled' || account.status === 'pending') {
    redirect(adminDestination(adminForAccount(account)));
  }
  if (account.status === 'missing') {
    const opening=await enrollmentRedirect(async()=>(await applicationEnrollment()).inspect());
    if(opening)redirect(opening);
    redirect('/admin/sign-in/error');
  }
  return <LoginScreen audience="admin"><EmployeeLogin audience="admin" /></LoginScreen>;
}
