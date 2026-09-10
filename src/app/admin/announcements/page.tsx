import {redirect} from 'next/navigation';
import {currentAdminAccess} from '../../../server/authentication/admin-entry';
import {adminDestination} from '../../../server/authentication/admin';
import {applicationAuthorization} from '../../../server/authorization/application';
import {EntryShell} from '../../../components/entry-shell';
import {EmployeeSignOut} from '../../../components/employee-sign-out';
import {AnnouncementManager} from '../../../components/announcements/AnnouncementManager';
import type {Announcement} from '../../../announcements/model';
import '../../announcements.css';
export const dynamic='force-dynamic';
export default async function AnnouncementsPage(){const access=await currentAdminAccess();if(access.status!=='admin')redirect(adminDestination(access));let initial:Announcement[]|undefined;try{initial=await(await applicationAuthorization()).announcements(true);}catch{}return <EntryShell><main id="main-content"><AnnouncementManager initial={initial}/><EmployeeSignOut audience="admin"/></main></EntryShell>;}
