import {FeaturePage} from '../../../components/features/FeaturePage';
import {redirect} from 'next/navigation';
import {currentAdminAccess} from '../../../server/authentication/admin-entry';
import {adminDestination} from '../../../server/authentication/admin';
import {applicationAuthorization} from '../../../server/authorization/application';
import {dashboardQuery} from '../../../server/analytics/dashboard-http';
import type {DashboardData} from '../../../analytics/dashboard';
import {AnalyticsDashboard} from '../../../components/analytics/AnalyticsDashboard';
import {EntryShell} from '../../../components/entry-shell';
import {EmployeeSignOut} from '../../../components/employee-sign-out';
export const dynamic='force-dynamic';
export default async function AnalyticsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const access=await currentAdminAccess();if(access.status!=='admin')redirect(adminDestination(access));
 let data:DashboardData|undefined,state:'ready'|'unavailable'|'denied'|'invalid'='unavailable',days:7|30|90=30;
 try{const params=await searchParams,url=new URL('http://local/');for(const [key,value] of Object.entries(params)){if(typeof value!=='string')throw new Error('INVALID_INPUT');url.searchParams.set(key,value);}days=dashboardQuery(url);data=await (await applicationAuthorization()).analyticsDashboard(days);state='ready';}
 catch(error){const code=error instanceof Error?error.message.split(':')[0]:'';if(code==='INVALID_INPUT')state='invalid';else if(code==='FORBIDDEN')state='denied';}
 return <FeaturePage feature="analytics" admin><EntryShell><AnalyticsDashboard data={data} state={state} days={days}/><div className="analytics-account"><EmployeeSignOut audience="admin"/></div></EntryShell></FeaturePage>;
}
