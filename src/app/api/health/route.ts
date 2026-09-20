import {deploymentRelease} from '../../../config/readiness';
export function GET() {
  return Response.json({ status: 'ok', scope: 'web_process_only',release:deploymentRelease(process.env) }, { headers: { 'Cache-Control': 'no-store' } });
}
