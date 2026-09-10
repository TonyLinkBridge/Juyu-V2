import {redirect} from 'next/navigation';
import {currentAdminAccess} from '../../../server/authentication/admin-entry';
import {adminDestination} from '../../../server/authentication/admin';
import {applicationAuthorization} from '../../../server/authorization/application';
import {EntryShell} from '../../../components/entry-shell';
import {ReviewDecision} from '../../../components/review/ReviewDecision';
import type {ReviewDetail} from '../../../review/decision';
export const dynamic='force-dynamic';
export default async function ReviewPage({searchParams}:{searchParams:Promise<{article?:string|string[]}>}){
 const access=await currentAdminAccess();if(access.status!=='admin')redirect(adminDestination(access));
 const params=await searchParams;let initial:ReviewDetail|undefined;
 try{if(typeof params.article!=='string')throw new Error('INVALID_INPUT');initial=await(await applicationAuthorization()).reviewDetail(params.article);}catch{}
 return <EntryShell><main id="main-content" className="editor-main"><a href="/admin" className="back-link">← 内容管理</a><h1>二审处理</h1>{initial?<ReviewDecision initial={initial}/>:<section role="alert"><p>审核内容暂时无法读取。请核对文章及管理权限后重新读取。</p><a href={typeof params.article==='string'?`/admin/review?article=${encodeURIComponent(params.article)}`:'/admin'}>重新读取审核内容</a></section>}</main></EntryShell>;
}
