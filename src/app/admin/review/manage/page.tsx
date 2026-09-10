import {redirect} from 'next/navigation';
import {currentAdminAccess} from '../../../../server/authentication/admin-entry';
import {adminDestination} from '../../../../server/authentication/admin';
import {applicationAuthorization} from '../../../../server/authorization/application';
import {EntryShell} from '../../../../components/entry-shell';
import {ReviewControl} from '../../../../components/review/ReviewControl';
import type {ControlDetail} from '../../../../review/control';
export const dynamic='force-dynamic';
export default async function ManageReviewPage({searchParams}:{searchParams:Promise<{article?:string|string[]}>}){
 const access=await currentAdminAccess();if(access.status!=='admin')redirect(adminDestination(access));
 const params=await searchParams;let initial:ControlDetail|undefined;
 try{if(typeof params.article!=='string')throw new Error('INVALID_INPUT');initial=await(await applicationAuthorization()).controlReviewDetail(params.article);}catch{}
 return <EntryShell><main id="main-content" className="editor-main"><h1>管理本次审核</h1>{initial?<ReviewControl initial={initial}/>:<section role="alert"><p>审核状态暂时无法读取。请核对文章及管理权限后重试。</p><a href={typeof params.article==='string'?`/admin/review/manage?article=${encodeURIComponent(params.article)}`:'/admin'}>重新读取审核状态</a><a href="/admin">返回内容管理</a></section>}</main></EntryShell>;
}
