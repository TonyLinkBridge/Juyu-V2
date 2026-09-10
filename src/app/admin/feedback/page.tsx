import {FeaturePage} from '../../../components/features/FeaturePage';
import Link from 'next/link';
import {redirect} from 'next/navigation';
import {currentAdminAccess} from '../../../server/authentication/admin-entry';
import {adminDestination} from '../../../server/authentication/admin';
import {applicationAuthorization} from '../../../server/authorization/application';
import {EntryShell} from '../../../components/entry-shell';
import {FeedbackDashboard} from '../../../components/feedback-dashboard';
import {EmployeeSignOut} from '../../../components/employee-sign-out';
import {positiveInteger, type FeedbackOverview,type FeedbackDetails} from '../../../feedback/model';
export const dynamic='force-dynamic';
export default async function FeedbackPage({searchParams}:{searchParams:Promise<{document?:string|string[];revision?:string|string[];page?:string|string[]}>}){
 const access=await currentAdminAccess();if(access.status!=='admin')redirect(adminDestination(access));
 const params=await searchParams;let overview:FeedbackOverview|undefined,details:FeedbackDetails|undefined;let failed=false;
 try{const service=await applicationAuthorization();if(params.document!==undefined){if(typeof params.document!=='string'||typeof params.revision!=='string')throw new Error('INVALID_INPUT');details=await service.feedbackDetails(params.document,positiveInteger(Number(params.revision)),params.page);}else overview=await service.feedbackOverview(params.page);}
 catch{failed=true;}
 return <FeaturePage feature="feedback" admin><EntryShell><main id="main-content" className="members-main"><Link className="back-link" href="/admin">← 内容管理</Link><p className="card-kicker">READER FEEDBACK</p><h1>文章反馈</h1><p className="access-description">查看员工对各个正式版本的选择和说明，帮助定位需要改进的资料。</p>
  {failed?<div className="connection-notice" role="status"><div><strong>反馈暂时无法读取</strong><p>服务不可用，或该反馈记录已无法取得。请重新加载，或返回反馈列表。</p><Link className="secondary-link" href="/admin/feedback">返回反馈列表</Link></div></div>:<FeedbackDashboard overview={overview} details={details}/>}
  <EmployeeSignOut audience="admin"/>
 </main></EntryShell></FeaturePage>;
}
