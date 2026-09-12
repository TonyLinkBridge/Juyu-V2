import {measured} from '../../server/performance';
import {NewAnnouncements} from '../../components/announcements/NewAnnouncements';
import {applicationAuthorization} from '../../server/authorization/application';
import {TasksWorkspace} from '../../components/tasks/TasksWorkspace';
import type {QueryInput,WorkspaceData} from '../../workspace/model';
import { applicationEnrollment } from '../../server/enrollment/application';
import { enrollmentRedirect } from '../../server/enrollment/navigation';
import { redirect } from 'next/navigation';
import { currentAdminAccess } from '../../server/authentication/admin-entry';
import { adminDestination } from '../../server/authentication/admin';
import { EntryShell } from '../../components/entry-shell';
import { EmployeeSignOut } from '../../components/employee-sign-out';
export const dynamic = 'force-dynamic';
export default async function AdminWorkspace({searchParams}:{searchParams:Promise<QueryInput>}) {
 return measured('page.admin',async()=>{
  const opening=await enrollmentRedirect(async()=>(await applicationEnrollment()).inspect());
  if(opening)redirect(opening);
  const access = await currentAdminAccess();
  if (access.status !== 'admin') redirect(adminDestination(access));
  const params=await searchParams;let data:WorkspaceData|undefined,error:string|undefined;
  try{data=await (await applicationAuthorization()).workspace({...params,kind:params.kind??(params.scope==='review'?'all':'article'),view:params.view??'list'});}catch(e){error=e instanceof Error&&e.message==='INVALID_QUERY'?'筛选条件无效，请重新读取内容后设置。':'请稍后重试，或检查服务连接。';}
  return <EntryShell><NewAnnouncements/><TasksWorkspace data={data} error={error} account={<EmployeeSignOut audience="admin"/>}/></EntryShell>;
 });
}
