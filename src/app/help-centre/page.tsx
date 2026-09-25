import {closedFeatureFlags} from '../../features/model';
import {readerAnnouncement} from '../../config/reader-presentation';
import {parseSearchQuery,parseSearchScope,searchTitles,searchHref} from '../../reader/search';
import type {Publication} from '../../reader/body';
import {FumadocsDirectoryState} from '../../components/fumadocs/FumadocsDirectoryState';
import {FumadocsHomeShell,FumadocsKnowledgeHome} from '../../components/fumadocs/FumadocsKnowledgeHome';
import {FumadocsSearchPage} from '../../components/fumadocs/FumadocsSearchPage';
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
import {ShieldIcon} from '../../components/entry-shell';
import { EmployeeSignOut } from '../../components/employee-sign-out';
import {firstTreePage} from '../../reader/tree';
import {formalFumadocsPublicationPath} from '../../fumadocs/publication';
import type {MenuItem} from '../../navigation-settings/model';
export const dynamic = 'force-dynamic';
export default async function HelpCentre({searchParams,library=false}:{library?:boolean;searchParams:Promise<{article?:string|string[];q?:string|string[];page?:string|string[];scope?:string|string[];lang?:string|string[]}>}) {
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
    const homeLocale=homeParams.lang==='en'?'en':'zh-CN';
    if(homeParams.article===undefined&&homeParams.q===undefined){
      let home:Awaited<ReturnType<Awaited<ReturnType<typeof applicationAuthorization>>['home']>>|undefined;
      try{home=await(await applicationAuthorization()).home(homeLocale);}catch{}
      if(!home)return <FumadocsHomeShell account locale={homeLocale}><section className="message-main"><h1>{homeLocale==='en'?'The knowledge base is unavailable':'资料库暂时无法读取'}</h1><p>{homeLocale==='en'?'Try again later. A loading failure is not treated as an empty knowledge base.':'请稍后重试。读取失败不会被当作没有内容。'}</p><Link href={homeLocale==='en'?'/help-centre?lang=en':'/help-centre'}>{homeLocale==='en'?'Try again':'重新读取'}</Link></section></FumadocsHomeShell>;
      if(library){
        const first=firstTreePage(home.pages);
        if(first)redirect(first.href);
        return <FumadocsDirectoryState pages={home.pages} menu={home.menu} features={home.features} locale={homeLocale}/>;
      }
      return <FumadocsKnowledgeHome pages={home.pages} menu={home.menu} latest={home.latest} recent={home.recent} locale={homeLocale} search={home.features.search} showRecent={home.features.recent} admin={admin.status==='admin'} announcement={readerAnnouncement}/>;
    }
    let features=closedFeatureFlags,featuresUnavailable=false;
    let pages:NavigationNode[]=[],menu:MenuItem[]=[];
    let article:Publication|null=null;
    let failed=false;
    const params=await searchParams;
    const requested=params.article;
    const query=parseSearchQuery(params.q).query;
    const scope=parseSearchScope(params.scope);
    const locale=params.lang==='en'?'en':'zh-CN';
let authorization:Awaited<ReturnType<typeof applicationAuthorization>>|undefined;
if(params.q!==undefined){
  try{
    authorization=await applicationAuthorization();
    features=await authorization.features();
  }catch{
    featuresUnavailable=true;
  }
}
    if(params.q!==undefined&&!features.search){
      if(authorization)try{[pages,menu]=await Promise.all([authorization.categoryNavigationTree(),authorization.readerMenu()]);}catch{}
      return <FumadocsDirectoryState pages={pages} menu={menu} features={features} failed={featuresUnavailable} locale={locale}
       title={featuresUnavailable?(locale==='en'?'Search is temporarily unavailable':'搜索暂时无法使用'):(locale==='en'?'Search is turned off':'搜索已暂停')}
       description={featuresUnavailable?(locale==='en'?'Reload the page. If the problem continues, contact an admin.':'请重新加载页面，若持续失败请联系管理员。'):(locale==='en'?'An admin has turned search off. You can still browse published content from the directory.':'管理员已暂停搜索，你仍可从资料目录浏览已发布内容。')}
       retryHref={searchHref(query,1,scope??'all',locale)}/>;
    }
    if(params.q!==undefined){
      let search=searchTitles([],params.q,params.page);
      try{
        const service=authorization??await applicationAuthorization();
        if(scope===null){search={...search,status:'invalid'};pages=await service.categoryNavigationTree();}
        else ({pages,search}=await service.search(params.q,params.page,scope,locale));
        try{menu=await service.readerMenu();}catch{}
      }catch{failed=true;}
      return <FumadocsSearchPage pages={pages} menu={menu} features={features} search={search} scope={scope??'all'} failed={failed} locale={locale} retryHref={searchHref(query,search.page,scope??'all',locale)}/>;
    }
    let destination:string|undefined;
    try {
      const authorization=await applicationAuthorization();
      ({features,pages,article,destination}=await authorization.reader(requested));
      if(!destination&&!article)try{menu=await authorization.readerMenu();}catch{}
    } catch {failed=true;}
    if(destination)redirect(destination);
    if(article)redirect(formalFumadocsPublicationPath(article.id));
    return <FumadocsDirectoryState pages={pages} menu={menu} features={features} requested={requested} failed={failed} locale={locale}/>;
  }
  const opening=enrollment&&enrollment.status!=='ready';
  const denied = access.status === 'denied';
  const title = opening?'开通资料库访问':memberBlocked ? '资料库访问已暂停' : denied ? '公司账号验证未通过' : enrollment?.status==='ready'?'资料库账号已开通':'资料库访问尚未开通';
  const description = opening?'公司账号验证已通过，正在处理你的资料库权限。':memberBlocked ? '你的资料库权限已停用或正在核对。请联系管理员处理。' : denied
    ? '请使用同一公司的已验证邮箱和指定 Slack Workspace 账号。你可以退出后重新登录，或联系管理员核对账号。'
    : enrollment?.status==='ready'?'你的账号已开通。文章阅读页面仍在准备中，暂时不能查阅资料。':access.status === 'verified'
      ? '公司账号验证已通过。资料库仍在准备中，请等待管理员完成开通。'
      : '公司账号验证尚未配置，暂时不能查阅内部资料，请等待管理员完成设置。';
  return <FumadocsHomeShell><div className="access-main"><section className="access-card">
    <div className="entry-icon"><ShieldIcon /></div><p className="card-kicker">TEAM KNOWLEDGE</p>
    <h1>{title}</h1><p className="access-description">{description}</p>
    {opening&&<EnrollmentPanel initial={enrollment!}/>}
    {!opening && !memberBlocked && admin.status === 'admin' && <Link className="secondary-link" href="/admin">进入管理后台</Link>}
    <EmployeeSignOut />
  </section></div></FumadocsHomeShell>;
}
