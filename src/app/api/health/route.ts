export function GET() {
  return Response.json({ status: 'ok', scope: 'web_process_only' }, { headers: { 'Cache-Control': 'no-store' } });
}
