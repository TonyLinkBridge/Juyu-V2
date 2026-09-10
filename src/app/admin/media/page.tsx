import {decodeEditorBody} from '../../../editor/document';
import {currentAdminAccess} from '../../../server/authentication/admin-entry';
import {adminDestination} from '../../../server/authentication/admin';
import {applicationAuthorization} from '../../../server/authorization/application';
import {EntryShell} from '../../../components/entry-shell';
import {MediaEditor} from '../../../components/media-editor';
import {redirect} from 'next/navigation';
import Link from 'next/link';
import type {MediaEditorData} from '../../../media/editor';
export const dynamic='force-dynamic';
export default async function MediaPage({searchParams}:{searchParams:Promise<{article?:string|string[];page?:string|string[]}>}){
 const access=await currentAdminAccess();if(access.status!=='admin')redirect(adminDestination(access));
 const params=await searchParams;let editor:MediaEditorData|undefined;let listing:Awaited<ReturnType<Awaited<ReturnType<typeof applicationAuthorization>>['mediaDocuments']>>|undefined;let failed=false;
 try{const service=await applicationAuthorization();if(typeof params.article==='string')editor=await service.media(params.article);else listing=await service.mediaDocuments(params.page===undefined?1:Number(params.page));}catch{failed=true;}
 return <EntryShell><main id="main-content" className="members-main"><Link className="back-link" href="/admin">← 内容管理</Link><h1>媒体与表格</h1><p className="access-description">选择已有文章，管理媒体、表格、提示框、代码框和分页标签；改动保存为草稿，审核发布后生效。</p>
  {failed?<p role="status">资料暂时无法读取，请重新加载或返回列表。</p>:editor?<><Link href="/admin/media">← 选择其他文章</Link><h2>{editor.title}</h2>{decodeEditorBody(editor.body)?<Link href={`/admin/editor?article=${encodeURIComponent(editor.documentId)}`}>前往完整文章编辑器管理内容与文件</Link>:<MediaEditor key={`${editor.documentId}:${editor.sequence}`} initial={editor}/>}</>:listing?<>{listing.total===0?<p>还没有文章。新建文章入口将在内容工作台与编辑器接入。</p>:<ul className="media-documents">{listing.items.map(row=><li key={row.id}><Link href={`/admin/media?article=${encodeURIComponent(row.id)}`}>{row.title}</Link></li>)}</ul>}<nav className="search-pagination" aria-label="文章分页">{listing.page>1&&<Link href={`/admin/media?page=${listing.page-1}`}>上一页</Link>}<span>第 {listing.page} / {listing.pages} 页 · 共 {listing.total} 篇</span>{listing.page<listing.pages&&<Link href={`/admin/media?page=${listing.page+1}`}>下一页</Link>}</nav></>:null}
 </main></EntryShell>;
}
