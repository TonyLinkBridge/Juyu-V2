import {FeaturePage} from '../../../../components/features/FeaturePage';
import {redirect} from 'next/navigation';
import {currentAdminAccess} from '../../../../server/authentication/admin-entry';
import {adminDestination} from '../../../../server/authentication/admin';
import {applicationAuthorization} from '../../../../server/authorization/application';
import {EntryShell} from '../../../../components/entry-shell';
import {EmployeeSignOut} from '../../../../components/employee-sign-out';
import {FormSettings} from '../../../../components/forms/FormSettings';
import type {FormDefinition} from '../../../../forms/model';
import type {FieldDefinition} from '../../../../fields/model';
import '../../../forms-settings.css';
export const dynamic='force-dynamic';
export default async function FormsSettingsPage(){const access=await currentAdminAccess();if(access.status!=='admin')redirect(adminDestination(access));let initial:FormDefinition[]|undefined,definitions:FieldDefinition[]|undefined,state:'ready'|'denied'|'unavailable'='unavailable';try{const service=await applicationAuthorization();[initial,definitions]=await Promise.all([service.forms(true),service.fields()]);state='ready';}catch(e){if(e instanceof Error&&e.message.startsWith('FORBIDDEN'))state='denied';}return <FeaturePage feature="forms" admin><EntryShell><main id="main-content"><FormSettings initial={initial} definitions={definitions} state={state}/><EmployeeSignOut audience="admin"/></main></EntryShell></FeaturePage>;}
