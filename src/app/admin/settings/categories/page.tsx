import {redirect} from 'next/navigation';
import {currentAdminAccess} from '../../../../server/authentication/admin-entry';
import {adminDestination} from '../../../../server/authentication/admin';
import {applicationAuthorization} from '../../../../server/authorization/application';
import {EntryShell} from '../../../../components/entry-shell';
import {EmployeeSignOut} from '../../../../components/employee-sign-out';
import {CategorySettings} from '../../../../components/categories/CategorySettings';
import type {CategoryDefinition} from '../../../../categories/model';
import '../../../categories-settings.css';
export const dynamic='force-dynamic';
export default async function CategoriesPage(){const access=await currentAdminAccess();if(access.status!=='admin')redirect(adminDestination(access));let initial:CategoryDefinition[]|undefined,state:'ready'|'denied'|'unavailable'='unavailable';try{initial=await(await applicationAuthorization()).categories();state='ready';}catch(e){if(e instanceof Error&&e.message.startsWith('FORBIDDEN'))state='denied';}return <EntryShell><main id="main-content"><CategorySettings initial={initial} state={state}/><div className="analytics-account"><a className="secondary-link" href="/admin/settings/history">设置变更记录</a><EmployeeSignOut audience="admin"/></div></main></EntryShell>;}
