import Link from 'next/link';
import type { Metadata } from 'next';
import { EntryShell, ShieldIcon } from '../../../components/entry-shell';
import { EmployeeSignOut } from '../../../components/employee-sign-out';
import { clerkConfiguration } from '../../../config/clerk';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '无法进入后台' };
export default function AdminDenied() {
  return <EntryShell><main id="main-content" className="access-main"><section className="access-card">
    <div className="entry-icon"><ShieldIcon /></div><p className="card-kicker">CONTENT WORKSPACE</p>
    <h1>没有后台访问权限</h1><p className="access-description">后台仅向通过公司验证的管理员开放。需要调整权限时，请联系管理员。</p>
    <Link className="primary-link" href="/help-centre">返回员工资料库</Link>
    {clerkConfiguration(process.env) === 'configured' && <EmployeeSignOut audience="admin" />}
  </section></main></EntryShell>;
}
