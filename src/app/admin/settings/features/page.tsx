import {redirect} from 'next/navigation';
import {currentAdminAccess} from '../../../../server/authentication/admin-entry';
import {adminDestination} from '../../../../server/authentication/admin';
import {applicationAuthorization} from '../../../../server/authorization/application';
import {EntryShell} from '../../../../components/entry-shell';
import {EmployeeSignOut} from '../../../../components/employee-sign-out';
import {FeatureSettings} from '../../../../components/features/FeatureSettings';
import type {FeatureConfig} from '../../../../features/model';
import '../../../feature-settings.css';
export const dynamic='force-dynamic';
export default async function FeatureSettingsPage(){const access=await currentAdminAccess();if(access.status!=='admin')redirect(adminDestination(access));let initial:FeatureConfig|undefined;try{initial=await(await applicationAuthorization()).featureConfig();}catch{}return <EntryShell><main id="main-content"><FeatureSettings initial={initial}/><EmployeeSignOut audience="admin"/></main></EntryShell>;}
