import {applicationAuthorization} from '../../../server/authorization/application';
import {readAnalyticsBody,analyticsResponse} from '../../../server/analytics/http';
export const dynamic='force-dynamic';
export async function POST(request:Request){return analyticsResponse(async()=>{const service=await applicationAuthorization();return service.captureAnalytics(await readAnalyticsBody(request));});}
