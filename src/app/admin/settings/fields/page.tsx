import {redirect} from 'next/navigation';
import {currentAdminAccess} from '../../../../server/authentication/admin-entry';
import {adminDestination} from '../../../../server/authentication/admin';
import {applicationAuthorization} from '../../../../server/authorization/application';
import {EntryShell} from '../../../../components/entry-shell';
import {EmployeeSignOut} from '../../../../components/employee-sign-out';
import {FieldSettings} from '../../../../components/fields/FieldSettings';
import type {FieldDefinition} from '../../../../fields/model';
import '../../../fields-settings.css';
export const dynamic='force-dynamic';
export default async function FieldsPage(){const access=await currentAdminAccess();if(access.status!=='admin')redirect(adminDestination(access));let initial:FieldDefinition[]|undefined,state:'ready'|'denied'|'unavailable'='unavailable';try{initial=await(await applicationAuthorization()).fields();state='ready';}catch(e){if(e instanceof Error&&e.message.startsWith('FORBIDDEN'))state='denied';}return <EntryShell><main id="main-content"><FieldSettings initial={initial} state={state}/><div className="analytics-account"><a className="secondary-link" href="/admin/settings/history">设置变更记录</a><EmployeeSignOut audience="admin"/></div></main></EntryShell>;}
