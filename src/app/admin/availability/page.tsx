import {redirect} from 'next/navigation';
import {currentAdminAccess} from '../../../server/authentication/admin-entry';
import {adminDestination} from '../../../server/authentication/admin';
import {applicationAuthorization} from '../../../server/authorization/application';
import {EntryShell} from '../../../components/entry-shell';
import {AvailabilityPanel} from '../../../components/availability/AvailabilityPanel';
import {ArchivesList} from '../../../components/availability/ArchivesList';
import type {AvailabilityDetail,ArchivePage} from '../../../availability/model';
export const dynamic='force-dynamic';
export default async function AvailabilityPage({searchParams}:{searchParams:Promise<{article?:string|string[];page?:string|string[]}>}){
 const access=await currentAdminAccess();if(access.status!=='admin')redirect(adminDestination(access));
 const params=await searchParams;let detail:AvailabilityDetail|undefined,data:ArchivePage|undefined;
 try{const service=await applicationAuthorization();if(params.article!==undefined){if(typeof params.article!=='string')throw new Error('INVALID_INPUT');detail=await service.availabilityDetail(params.article);}else{const page=params.page??'1';if(typeof page!=='string'||!/^[1-9]\d{0,5}$/.test(page))throw new Error('INVALID_INPUT');data=await service.archives(Number(page));}}catch{}
 return <EntryShell><main id="main-content" className="editor-main"><h1>{params.article!==undefined?'归档与下线':'归档资料管理'}</h1>{params.article===undefined?<ArchivesList data={data}/>:detail?<AvailabilityPanel initial={detail}/>:<section role="alert"><p>资料状态暂时无法读取，请核对文章及管理权限后重试。</p><a href={typeof params.article==='string'?`/admin/availability?article=${encodeURIComponent(params.article)}`:'/admin/availability'}>重新读取资料状态</a> · <a href="/admin/availability">归档资料列表</a></section>}</main></EntryShell>;
}
