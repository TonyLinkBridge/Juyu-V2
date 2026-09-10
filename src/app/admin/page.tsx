import {NewAnnouncements} from '../../components/announcements/NewAnnouncements';
import {closedFeatureFlags} from '../../features/model';
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
  const opening=await enrollmentRedirect(async()=>(await applicationEnrollment()).inspect());
  if(opening)redirect(opening);
  const access = await currentAdminAccess();
  if (access.status !== 'admin') redirect(adminDestination(access));
  const params=await searchParams;let data:WorkspaceData|undefined,error:string|undefined;
  try{data=await (await applicationAuthorization()).workspace(params);}catch(e){error=e instanceof Error&&e.message==='INVALID_QUERY'?'筛选条件无效，请重新读取内容后设置。':'请稍后重试，或检查服务连接。';}
  let features=closedFeatureFlags;try{features=await(await applicationAuthorization()).features();}catch{}
  return <EntryShell><NewAnnouncements/><TasksWorkspace features={features} data={data} error={error} account={<EmployeeSignOut audience="admin"/>}/></EntryShell>;
}
