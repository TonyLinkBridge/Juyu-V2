import {redirect} from 'next/navigation';
import {currentAdminAccess} from '../../../server/authentication/admin-entry';
import {adminDestination} from '../../../server/authentication/admin';
import {applicationAuthorization} from '../../../server/authorization/application';
import {EntryShell} from '../../../components/entry-shell';
import {TrashManager} from '../../../components/lifecycle/TrashManager';
import type {LifecyclePage} from '../../../lifecycle/model';
export const dynamic='force-dynamic';
export default async function TrashPage({searchParams}:{searchParams:Promise<{page?:string|string[];cleanupPage?:string|string[]}>}){
 const access=await currentAdminAccess();if(access.status!=='admin')redirect(adminDestination(access));
 let initial:LifecyclePage|undefined;try{const p=await searchParams;if(Array.isArray(p.page)||Array.isArray(p.cleanupPage))throw new Error('INVALID_INPUT');initial=await (await applicationAuthorization()).trash(Number(p.page??1),Number(p.cleanupPage??1));}catch{}
 return <EntryShell><TrashManager initial={initial}/></EntryShell>;
}
