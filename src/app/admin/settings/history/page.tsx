import {redirect} from 'next/navigation';
import {currentAdminAccess} from '../../../../server/authentication/admin-entry';
import {adminDestination} from '../../../../server/authentication/admin';
import {applicationAuthorization} from '../../../../server/authorization/application';
import {EntryShell} from '../../../../components/entry-shell';
import {EmployeeSignOut} from '../../../../components/employee-sign-out';
import {SettingHistory} from '../../../../components/setting-history/SettingHistory';
import type {HistoryPage} from '../../../../setting-history/model';
import '../../../setting-history.css';
export const dynamic='force-dynamic';
export default async function SettingHistoryPage(){const access=await currentAdminAccess();if(access.status!=='admin')redirect(adminDestination(access));let initial:HistoryPage|undefined;try{initial=await(await applicationAuthorization()).settingHistory();}catch{}return <EntryShell><main id="main-content"><SettingHistory initial={initial}/><EmployeeSignOut audience="admin"/></main></EntryShell>;}
