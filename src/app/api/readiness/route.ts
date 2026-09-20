import {applicationReadiness} from '../../../server/readiness';
export const dynamic='force-dynamic';
export async function GET(){const report=await applicationReadiness();return Response.json(report,{status:report.status==='ready'?200:503,headers:{'Cache-Control':'no-store'}});}
