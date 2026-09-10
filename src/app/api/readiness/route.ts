import { getReadinessReport } from '../../../config/readiness';
export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json(getReadinessReport(process.env), { status: 503, headers: { 'Cache-Control': 'no-store' } });
}
