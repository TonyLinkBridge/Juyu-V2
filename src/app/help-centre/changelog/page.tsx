import Link from 'next/link';
import {redirect} from 'next/navigation';
import {EntryShell} from '../../../components/entry-shell';
import {ReaderMenu} from '../../../components/navigation-settings/ReaderMenu';
import {SearchInput} from '../../../components/gitbook/Search/SearchInput';
import {clerkConfiguration} from '../../../config/clerk';
import {contentPath} from '../../../reader/content-path';
import {employeeCompanyAccess} from '../../../server/authentication/company-clerk';
import {applicationEnrollment} from '../../../server/enrollment/application';
import {applicationAuthorization} from '../../../server/authorization/application';
import {bindCurrentMember} from '../../../server/members/entry';

export const dynamic='force-dynamic';
export default async function Changelog({searchParams}:{searchParams:Promise<{page?:string;lang?:string}>}){
 const access=await employeeCompanyAccess();
 if(access.status==='signed_out'||clerkConfiguration(process.env)!=='configured')redirect('/sign-in');
 if(access.status==='unavailable')redirect('/sign-in/error');
 if(access.status!=='verified')redirect('/help-centre');
 let ready=false;
 try{if((await(await applicationEnrollment()).inspect()).status==='ready'){await bindCurrentMember();ready=true;}}catch{}
 if(!ready)redirect('/help-centre');
 const params=await searchParams,raw=params.page,locale=params.lang==='en'?'en':'zh-CN',english=locale==='en';
 const page=raw===undefined?1:/^[1-9]\d{0,2}$/.test(raw)?Number(raw):null;
 let data:Awaited<ReturnType<Awaited<ReturnType<typeof applicationAuthorization>>['changelog']>>|null=null;
 let failed=page===null;
 if(page!==null)try{data=await(await applicationAuthorization()).changelog(page,locale);}catch{failed=true;}
 return <EntryShell account navigation={<ReaderMenu currentHref="/help-centre/changelog"/>} search={<SearchInput query="" locale={locale}/> }><main id="main-content" className="editor-main search-main reader-changelog">
   <Link href={english?'/help-centre?lang=en':'/help-centre'}>{english?'← Help Centre':'← 帮助中心'}</Link><h1>{english?'What’s new':'更新日志'}</h1><p>{english?'Published updates you can currently access, newest first.':'按正式发布时间排列当前可阅读的资料。仅显示你有权限查看的已发布版本。'}</p>
   {failed?<div role="alert">{english?'Updates are unavailable right now.':'更新日志暂时无法读取。'}<Link href={english?'/help-centre/changelog?lang=en':'/help-centre/changelog'}>{english?'Try again':'重新读取'}</Link></div>:data?.items.length?<ol>{data.items.map(item=><li key={item.id}><time dateTime={item.at}>{new Intl.DateTimeFormat(english?'en-MY':'zh-CN',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'long',day:'numeric'}).format(new Date(item.at))}</time><Link href={contentPath(item.kind,item.id,locale)}>{item.title}</Link><span>{english?({article:'Article',ops:'OPS Internal',reference:'Reference',qa:'Q&A'}[item.kind]):item.kind==='qa'?'Q&A':item.kind==='ops'?'OPS Internal':item.kind==='reference'?'Reference':'知识文章'} · {english?(item.publicationNumber?`Version ${item.publicationNumber}`:'Published'):(item.publicationNumber?`正式版本 ${item.publicationNumber}`:'已发布')}</span>{item.releaseNote&&<p className="reader-changelog-note">{item.releaseNote}</p>}</li>)}</ol>:<p className="reader-changelog-empty">{english?'No published updates are available yet.':'目前没有可阅读的正式更新。'}</p>}
   {data&&<nav aria-label={english?'Updates pages':'更新日志分页'}>{data.page>1&&<Link href={english?`/help-centre/changelog?lang=en${data.page===2?'':`&page=${data.page-1}`}`:data.page===2?'/help-centre/changelog':`/help-centre/changelog?page=${data.page-1}`}>{english?'Previous':'上一页'}</Link>}{data.hasMore&&<Link href={english?`/help-centre/changelog?lang=en&page=${data.page+1}`:`/help-centre/changelog?page=${data.page+1}`}>{english?'Next':'下一页'}</Link>}</nav>}
 </main></EntryShell>;
}
