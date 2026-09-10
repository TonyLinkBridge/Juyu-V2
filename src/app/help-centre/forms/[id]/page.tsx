import {FeaturePage} from '../../../../components/features/FeaturePage';
import {ReaderMenu} from '../../../../components/navigation-settings/ReaderMenu';
import Link from 'next/link';
import {requireFormReaderEntry} from '../../../../server/forms/entry';
import {applicationAuthorization} from '../../../../server/authorization/application';
import {EntryShell} from '../../../../components/entry-shell';
import {FormFill} from '../../../../components/forms/FormViews';
import type {FormDefinition} from '../../../../forms/model';
import '../../../forms.css';
export const dynamic='force-dynamic';
export default async function FillPage({params}:{params:Promise<{id:string}>}){await requireFormReaderEntry();let data:FormDefinition|undefined;try{data=await(await applicationAuthorization()).form((await params).id);}catch{}return <FeaturePage feature="forms"><EntryShell navigation={<ReaderMenu currentHref="/help-centre/forms"/>}><main id="main-content" className="forms-main">{data?<FormFill initial={data}/>:<section role="status"><h1>表单暂时不可用</h1><p>表单可能已停用、没有访问权限，或服务暂时无法连接。</p><Link prefetch={false} href="/help-centre/forms">返回表单列表</Link></section>}</main></EntryShell></FeaturePage>;}
