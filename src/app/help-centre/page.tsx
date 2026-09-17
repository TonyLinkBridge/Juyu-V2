import {closedFeatureFlags} from '../../features/model';
import {FeatureNotice} from '../../components/features/FeatureNotice';
import {ArticleAnalytics} from '../../components/analytics/ArticleAnalytics';
import {SearchAnalytics} from '../../components/analytics/SearchAnalytics';
import {RecentRecorder} from '../../components/recent/RecentRecorder';
import {FavoriteButton} from '../../components/favorites/FavoriteButton';
import {ReaderMenu} from '../../components/navigation-settings/ReaderMenu';
import {readerAnnouncement} from '../../config/reader-presentation';
import {SearchInput} from '../../components/gitbook/Search/SearchInput';
import {SearchResults} from '../../components/gitbook/Search/SearchResults';
import {parseSearchQuery,searchTitles,searchHref} from '../../reader/search';
import type {Publication} from '../../reader/body';
import {ReaderNavigation} from '../../components/reader-navigation';
import {applicationAuthorization} from '../../server/authorization/application';
import type {NavigationNode} from '../../reader/tree';
import { applicationEnrollment } from '../../server/enrollment/application';
import type { EnrollmentResult } from '../../server/enrollment/service';
import { EnrollmentPanel } from '../../components/enrollment-panel';
import { bindCurrentMember } from '../../server/members/entry';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { adminForCompany } from '../../server/authentication/admin-clerk';
import { clerkConfiguration } from '../../config/clerk';
import { employeeCompanyAccess } from '../../server/authentication/company-clerk';
import { EntryShell, ShieldIcon } from '../../components/entry-shell';
import { EmployeeSignOut } from '../../components/employee-sign-out';
import {firstTreePage} from '../../reader/tree';
import {KnowledgeHome} from '../../components/home/KnowledgeHome';
import {ReaderQuickLinks} from '../../components/navigation-settings/ReaderQuickLinks';
export const dynamic = 'force-dynamic';
export default async function HelpCentre({searchParams,library=false}:{library?:boolean;searchParams:Promise<{article?:string|string[];q?:string|string[];page?:string|string[]}>}) {
  const access = await employeeCompanyAccess();
  if (access.status === 'signed_out') redirect('/sign-in');
  if (access.status === 'unavailable') redirect('/sign-in/error');
  // Missing Clerk configuration must still show the existing employee login entry.
  if (clerkConfiguration(process.env) !== 'configured') redirect('/sign-in');
const adminPromise = adminForCompany(access);
let memberBlocked = false;
let enrollment: EnrollmentResult | null = null;
if (access.status === 'verified') {
  try {
    enrollment = await (await applicationEnrollment()).inspect();
    if (enrollment.status === 'ready') {
      await bindCurrentMember();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    memberBlocked =
      message.startsWith('FORBIDDEN') ||
      message === 'MEMBER_PENDING';
  }
}
const admin = await adminPromise;
  if(enrollment?.status==='ready'&&!memberBlocked) {
    const homeParams=await searchParams;
    if(homeParams.article===undefined&&homeParams.q===undefined){
      let home:Awaited<ReturnType<Awaited<ReturnType<typeof applicationAuthorization>>['home']>>|undefined;
      try{home=await(await applicationAuthorization()).home();}catch{}
      if(!home)return <EntryShell><main id="main-content" className="message-main"><h1>资料库暂时无法读取</h1><p>请稍后重试。读取失败不会被当作没有内容。</p><Link href="/help-centre">重新读取</Link></main></EntryShell>;
      if(library){
        const first=firstTreePage(home.pages);
        if(first)redirect(first.href);
        return <EntryShell account search={home.features.search?<SearchInput query=""/>:undefined}><ReaderNavigation pages={home.pages} features={home.features}/></EntryShell>;
      }
      return <EntryShell account announcement={readerAnnouncement} navigation={<ReaderQuickLinks items={home.menu} currentHref="/help-centre"/>} search={home.features.search?<SearchInput query=""/>:undefined}>{<KnowledgeHome {...home} search={home.features.search} showRecent={home.features.recent} admin={admin.status==='admin'}/>}</EntryShell>;
    }
    let features=closedFeatureFlags,featuresUnavailable=false;
let pages:NavigationNode[]=[];
let article:Publication|null=null;
let failed=false;
const params=await searchParams;
const requested=params.article;
const query=parseSearchQuery(params.q).query;
if(params.q!==undefined){
  try{
    features=await(await applicationAuthorization()).features();
  }catch{
    featuresUnavailable=true;
  }
}
let input=features.search?<SearchInput key={query} query={query}/>:undefined;
    if(params.q!==undefined&&!features.search)return <EntryShell navigation={<ReaderMenu/>}><FeatureNotice feature="search" unavailable={featuresUnavailable}/></EntryShell>;
    if(params.q!==undefined){
      let search=searchTitles([],params.q,params.page);
      try {({pages,search}=await (await applicationAuthorization()).search(params.q,params.page));}catch{failed=true;}
      return <EntryShell navigation={<ReaderMenu currentHref="/help-centre"/>} search={input} announcement={failed ? undefined : readerAnnouncement}><div className="reader-search-layout">
        <SearchAnalytics search={search} enabled={!failed&&features.analytics}><SearchResults search={search} failed={failed} retryHref={searchHref(query,search.page)}/></SearchAnalytics>
      </div></EntryShell>;
    }
    let favorite:import('../../favorites/model').FavoriteState|undefined;
    let section:'ops'|undefined;let destination:string|undefined;try {({features,pages,article,destination,favorite,section}=await (await applicationAuthorization()).reader(requested));input=features.search?<SearchInput key={query} query={query}/>:undefined;} catch {failed=true;}
    if(destination)redirect(destination);
    return <EntryShell account search={input} announcement={failed ? undefined : readerAnnouncement}><ReaderNavigation section={section} features={features} pages={pages} requested={requested} failed={failed} article={article} articleActions={!failed&&article?<>{features.favorites&&<FavoriteButton documentId={article.id} revision={article.revision} initial={favorite}/>}{features.recent&&<RecentRecorder documentId={article.id} revision={article.revision}/>}{features.analytics&&<ArticleAnalytics documentId={article.id} revision={article.revision}/>}</>:undefined}/></EntryShell>;
  }
  const opening=enrollment&&enrollment.status!=='ready';
  const denied = access.status === 'denied';
  const title = opening?'开通资料库访问':memberBlocked ? '资料库访问已暂停' : denied ? '公司账号验证未通过' : enrollment?.status==='ready'?'资料库账号已开通':'资料库访问尚未开通';
  const description = opening?'公司账号验证已通过，正在处理你的资料库权限。':memberBlocked ? '你的资料库权限已停用或正在核对。请联系管理员处理。' : denied
    ? '请使用同一公司的已验证邮箱和指定 Slack Workspace 账号。你可以退出后重新登录，或联系管理员核对账号。'
    : enrollment?.status==='ready'?'你的账号已开通。文章阅读页面仍在准备中，暂时不能查阅资料。':access.status === 'verified'
      ? '公司账号验证已通过。资料库仍在准备中，请等待管理员完成开通。'
      : '公司账号验证尚未配置，暂时不能查阅内部资料，请等待管理员完成设置。';
  return <EntryShell><main id="main-content" className="access-main"><section className="access-card">
    <div className="entry-icon"><ShieldIcon /></div><p className="card-kicker">TEAM KNOWLEDGE</p>
    <h1>{title}</h1><p className="access-description">{description}</p>
    {opening&&<EnrollmentPanel initial={enrollment!}/>}
    {!opening && !memberBlocked && admin.status === 'admin' && <Link className="secondary-link" href="/admin">进入管理后台</Link>}
    <EmployeeSignOut />
  </section></main></EntryShell>;
}
