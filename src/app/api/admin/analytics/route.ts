import {applicationAuthorization} from '../../../../server/authorization/application';
import {dashboardQuery,dashboardResponse} from '../../../../server/analytics/dashboard-http';
export const dynamic='force-dynamic';
export async function GET(request:Request){return dashboardResponse(async()=>{const service=await applicationAuthorization();return service.analyticsDashboard(dashboardQuery(new URL(request.url)));});}
