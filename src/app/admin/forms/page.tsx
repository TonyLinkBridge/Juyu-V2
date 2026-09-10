import {FeaturePage} from '../../../components/features/FeaturePage';
import {redirect} from 'next/navigation';
import {currentAdminAccess} from '../../../server/authentication/admin-entry';
import {adminDestination} from '../../../server/authentication/admin';
import {applicationAuthorization} from '../../../server/authorization/application';
import {EntryShell} from '../../../components/entry-shell';
import {FormRecords} from '../../../components/forms/FormViews';
import {formPage} from '../../../server/forms/http';
import type {FormRecordPage} from '../../../forms/model';
import '../../forms.css';
export const dynamic='force-dynamic';
export default async function RecordsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const access=await currentAdminAccess();if(access.status!=='admin')redirect(adminDestination(access));let data:FormRecordPage|undefined;try{const query=await searchParams,url=new URL('http://local');for(const [k,v] of Object.entries(query)){if(typeof v!=='string')throw new Error('INVALID_INPUT');url.searchParams.set(k,v);}data=await(await applicationAuthorization()).formRecords(formPage(url));}catch{}return <FeaturePage feature="forms" admin><EntryShell><main id="main-content" className="forms-main"><FormRecords data={data}/></main></EntryShell></FeaturePage>;}
