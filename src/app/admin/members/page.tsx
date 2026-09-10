import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentAdminAccess } from '../../../server/authentication/admin-entry';
import { adminDestination } from '../../../server/authentication/admin';
import { applicationMembers } from '../../../server/members/application';
import { EntryShell } from '../../../components/entry-shell';
import { EmployeeSignOut } from '../../../components/employee-sign-out';
import { MembersPanel } from '../../../components/members-panel';
export const dynamic='force-dynamic';
export default async function MembersPage(){
 const access=await currentAdminAccess();if(access.status!=='admin')redirect(adminDestination(access));
 let data=null;
 try{data=await (await applicationMembers()).list();}catch{/* Never render synthetic members when unavailable. */}
 return <EntryShell><main id="main-content" className="members-main">
  <Link href="/admin" className="back-link">← 内容管理</Link><p className="card-kicker">TEAM ACCESS</p><h1>成员与权限</h1>
  <p className="access-description">管理资料库成员的角色与访问。新成员通过公司验证后，会显示在这里。</p>
  {data?<MembersPanel initial={data}/>:<div className="connection-notice" role="status"><div><strong>成员服务尚未连接或暂时不可用</strong><p>请完成登录与数据库配置后重试。这里暂时无法读取或修改成员。</p></div></div>}
  <EmployeeSignOut audience="admin"/>
 </main></EntryShell>;
}
