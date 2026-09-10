import {redirect} from 'next/navigation';
import {currentAdminAccess} from '../../../../server/authentication/admin-entry';
import {adminDestination} from '../../../../server/authentication/admin';
import {applicationAuthorization} from '../../../../server/authorization/application';
import {EntryShell} from '../../../../components/entry-shell';
import {EmployeeSignOut} from '../../../../components/employee-sign-out';
import {NavigationSettings} from '../../../../components/navigation-settings/NavigationSettings';
import type {NavigationConfig} from '../../../../navigation-settings/model';
import type {CategoryDefinition} from '../../../../categories/model';
import '../../../navigation-settings.css';
export const dynamic='force-dynamic';
export default async function NavigationSettingsPage(){
 const access=await currentAdminAccess();if(access.status!=='admin')redirect(adminDestination(access));
 let initial:NavigationConfig|undefined,categories:CategoryDefinition[]|undefined,state:'ready'|'denied'|'unavailable'='unavailable';
 try{const service=await applicationAuthorization();[initial,categories]=await Promise.all([service.navigationSettings(),service.categories()]);state='ready';}catch(error){if(error instanceof Error&&error.message.startsWith('FORBIDDEN'))state='denied';}
 return <EntryShell><main id="main-content"><NavigationSettings initial={initial} categories={categories} state={state}/><EmployeeSignOut audience="admin"/></main></EntryShell>;
}
