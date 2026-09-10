import {FeaturePage} from '../../../../components/features/FeaturePage';
import Link from 'next/link';
import {redirect} from 'next/navigation';
import {currentAdminAccess} from '../../../../server/authentication/admin-entry';
import {adminDestination} from '../../../../server/authentication/admin';
import {applicationAuthorization} from '../../../../server/authorization/application';
import {EntryShell} from '../../../../components/entry-shell';
import {FormRecordView} from '../../../../components/forms/FormViews';
import type {FormRecord} from '../../../../forms/model';
import '../../../forms.css';
export const dynamic='force-dynamic';
export default async function RecordPage({params}:{params:Promise<{id:string}>}){const access=await currentAdminAccess();if(access.status!=='admin')redirect(adminDestination(access));let data:FormRecord|undefined;try{data=await(await applicationAuthorization()).formRecord((await params).id);}catch{}return <FeaturePage feature="forms" admin><EntryShell><main id="main-content" className="forms-main">{data?<FormRecordView initial={data}/>:<section role="status"><h1>提交记录暂时不可用</h1><p>未能读取记录，请稍后重试。</p><Link prefetch={false} href="/admin/forms">返回提交记录</Link></section>}</main></EntryShell></FeaturePage>;}
