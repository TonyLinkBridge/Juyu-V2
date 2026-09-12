import {measured,measuredRequest} from '../performance.ts';
import type { AssetFile, ByteRange, PrivateStorage } from './contract.ts';
import { validateAsset } from './contract.ts';

const baseHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin', 'Content-Security-Policy': 'sandbox' };
const inlineTypes = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'audio/mpeg', 'audio/ogg']);
function rangeFor(value: string | null, size: number): ByteRange | undefined {
  if (!value) return;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2]) || size === 0) throw new Error('INVALID_RANGE');
  const first = match[1] ? Number(match[1]) : undefined;
  const last = match[2] ? Number(match[2]) : undefined;
  if ((first !== undefined && !Number.isSafeInteger(first)) || (last !== undefined && !Number.isSafeInteger(last))) throw new Error('INVALID_RANGE');
  const start = first ?? Math.max(0, size - (last ?? 0));
  const end = first === undefined ? size - 1 : Math.min(last ?? size - 1, size - 1);
  if (start >= size || start > end) throw new Error('INVALID_RANGE');
  return { start, end };
}
export async function deliverAsset(request: Request, id: string, authorize: (id: string) => Promise<AssetFile | null>, store: PrivateStorage): Promise<Response> {
  return measuredRequest('asset',()=>deliverAuthorizedAsset(request,id,authorize,store));
}
async function deliverAuthorizedAsset(request:Request,id:string,authorize:(id:string)=>Promise<AssetFile|null>,store:PrivateStorage):Promise<Response>{
  let size: number | undefined;
  let upstream: Response | undefined;
  try {
    const asset = await measured('asset.authorize',()=>authorize(id));
    if (!asset) return Response.json({ error: 'NOT_FOUND' }, { status: 404, headers: baseHeaders });
    size = validateAsset(asset);
    if (asset.id !== id) throw new Error('INVALID_ASSET');
    const range = rangeFor(request.headers.get('Range'), size);
    const filename = encodeURIComponent(asset.filename.replace(/[\x00-\x1f\x7f]/g, '')).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
    upstream = await measured('storage.headers',()=>store.read(asset.object_key, range, request.signal));
    const expectedLength = range ? range.end - range.start + 1 : size;
    const contentRange = range ? `bytes ${range.start}-${range.end}/${size}` : null;
    if (upstream.status !== (range ? 206 : 200)
      || upstream.headers.get('content-length') !== String(expectedLength)
      || (range && upstream.headers.get('content-range') !== contentRange) || !upstream.body) {
      await upstream.body?.cancel(); throw new Error('STORAGE_RESPONSE_MISMATCH');
    }
    // Storage may respond after a takedown or role change. Recheck before releasing bytes.
    request.signal.throwIfAborted();
    const current = await measured('asset.recheck',()=>authorize(id));
    if (!current) {
      await upstream.body.cancel();
      return Response.json({ error: 'NOT_FOUND' }, { status: 404, headers: baseHeaders });
    }
    if (validateAsset(current) !== size || current.id !== asset.id || current.document_id !== asset.document_id
      || current.object_key !== asset.object_key || current.bucket !== asset.bucket || current.mime_type !== asset.mime_type
      || current.filename !== asset.filename) throw new Error('STORAGE_RESPONSE_MISMATCH');
    const inline = inlineTypes.has(asset.mime_type);
    const headers = new Headers(baseHeaders);
    headers.set('Content-Type', inline ? asset.mime_type : 'application/octet-stream');
    headers.set('Content-Disposition', `${inline && new URL(request.url).searchParams.get('download')!=='1' ? 'inline' : 'attachment'}; filename="download"; filename*=UTF-8''${filename}`);
    headers.set('Content-Length', String(expectedLength));
    headers.set('Accept-Ranges', 'bytes');
    if (contentRange) headers.set('Content-Range', contentRange);
    return new Response(upstream.body, { status: range ? 206 : 200, headers });
  } catch (error) {
    await upstream?.body?.cancel().catch(() => {});
    const message = error instanceof Error ? error.message : '';
    const status = message === 'INVALID_RANGE' ? 416 : message === 'AUTH_NOT_CONFIGURED' ? 503 : message.startsWith('FORBIDDEN') ? 403 : 502;
    const headers = new Headers(baseHeaders);
    if (status === 416 && size !== undefined) headers.set('Content-Range', `bytes */${size}`);
    return Response.json({ error: status === 416 ? 'INVALID_RANGE' : status === 503 ? 'AUTH_NOT_CONFIGURED' : status === 403 ? 'FORBIDDEN' : 'FILE_UNAVAILABLE' }, { status, headers });
  }
}
