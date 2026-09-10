import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import {LoginScreen} from '../../../components/login-screen';
import { EmployeeLogin } from '../../../components/employee-login';
import { employeeSession } from '../../../server/authentication/clerk';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '员工登录' };
export default async function EmployeeSignIn() {
  const session = await employeeSession();
  if (session.status === 'unconfigured') return <LoginScreen audience="employee"><div className="login-unavailable" role="status"><p>登录服务尚未连接</p><p>资料库暂未开放，请等待管理员完成开通。</p></div></LoginScreen>;
  if (session.status === 'unavailable') redirect('/sign-in/error');
  if (session.status === 'signed_in') redirect('/help-centre');
  return <LoginScreen><EmployeeLogin /></LoginScreen>;
}
