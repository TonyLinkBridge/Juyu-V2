import { validObjectKey } from './contract.ts';
import type { ByteRange, PrivateStorage } from './contract.ts';

/** Supabase REST may wrap NoSuchKey in HTTP 400 while preserving its semantic 404.
 * Official protocol: https://supabase.com/docs/guides/storage/debugging/error-codes
 * https://github.com/supabase/storage/blob/master/src/http/error-handler.ts
 */
async function confirmsObjectAbsence(response:Response):Promise<boolean>{
  if(response.status===404){await response.body?.cancel();return true;}
  if(response.status!==400||!response.body){await response.body?.cancel();return false;}
  const reader=response.body.getReader();
  try{
    const chunks:Uint8Array[]=[];
    let size=0;
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>4096)return false;
      chunks.push(value);
    }
    const error:unknown=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(!error||typeof error!=='object'||Array.isArray(error))return false;
    const detail=error as Record<string,unknown>;
    return detail.code==='NoSuchKey'
      && (detail.statusCode===undefined||detail.statusCode===404||detail.statusCode==='404')
      && (detail.httpStatusCode===undefined||detail.httpStatusCode===404||detail.httpStatusCode==='404')
      && (detail.error===undefined||detail.error==='not_found'||detail.error==='NoSuchKey');
  }catch{return false;}
  finally{await reader.cancel().catch(()=>{});}
}

/** Supabase may wrap NoSuchBucket/404 in HTTP 400. Never infer absence from message text. */
async function isWrappedMissingBucket(response:Response):Promise<boolean>{
  if(response.status!==400||!response.body)return false;
  const reader=response.body.getReader();
  try{
    const chunks:Uint8Array[]=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096)return false;chunks.push(value);}
    const detail:unknown=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(!detail||typeof detail!=='object'||Array.isArray(detail))return false;
    const error=detail as Record<string,unknown>;
    return error.code==='NoSuchBucket'&&(error.statusCode===404||error.statusCode==='404');
  }catch{return false;}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}

/** Server-only Storage credential. Never return this adapter or a signed Storage URL to a browser. */
export class SupabasePrivateStorage implements PrivateStorage {
  private origin: string;
  private key: string;
  private headerTimeoutMs: number;
  constructor(origin: string, key: string, options: { allowLoopback?: boolean; headerTimeoutMs?: number } = {}) {
    const url = new URL(origin);
    const local = options.allowLoopback && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
    if ((!local && url.protocol !== 'https:') || !['http:', 'https:'].includes(url.protocol)
      || url.username || url.password || url.pathname !== '/' || url.search || url.hash || !key.trim()) throw new Error('INVALID_STORAGE_CONFIGURATION');
    this.origin = url.origin; this.key = key;
    this.headerTimeoutMs = options.headerTimeoutMs ?? 30_000;
    if (!Number.isSafeInteger(this.headerTimeoutMs) || this.headerTimeoutMs < 1 || this.headerTimeoutMs > 120_000) throw new Error('INVALID_STORAGE_TIMEOUT');
  }
  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${this.key}`);
    headers.set('apikey', this.key);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startDeadline = () => { timer = setTimeout(() => controller.abort(), this.headerTimeoutMs); };
    let body = init.body;
    if (body instanceof ReadableStream) {
      // Start waiting-for-response deadline after the streaming upload has finished.
      body = body.pipeThrough(new TransformStream({ flush() { startDeadline(); } }));
    } else startDeadline();
    try {
      return await fetch(`${this.origin}/storage/v1${path}`, {
        ...init, body, headers, cache: 'no-store', redirect: 'error',
        signal: init.signal ? AbortSignal.any([controller.signal, init.signal]) : controller.signal,
      });
    } finally { if (timer) clearTimeout(timer); }
  }
  private async assertPrivate(signal?: AbortSignal) {
    const response = await this.request('/bucket/juyu-private', { signal });
    if (!response.ok) { await response.body?.cancel(); throw new Error('PRIVATE_BUCKET_UNAVAILABLE'); }
    const bucket = await response.json();
    if (bucket?.id !== 'juyu-private' || bucket.public !== false) throw new Error('PRIVATE_BUCKET_REQUIRED');
  }
  // Explicit operator action, never called automatically by a website request.
  async provisionPrivateBucket() {
    const current = await this.request('/bucket/juyu-private');
    if (current.status === 404 || await isWrappedMissingBucket(current)) {
      await current.body?.cancel();
      const created = await this.request('/bucket', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'juyu-private', name: 'juyu-private', public: false }) });
      if (!created.ok) { await created.body?.cancel(); throw new Error('PRIVATE_BUCKET_CREATE_FAILED'); }
      await created.body?.cancel();
    } else {
      await current.body?.cancel();
      if (!current.ok) throw new Error('PRIVATE_BUCKET_UNAVAILABLE');
    }
    await this.assertPrivate();
  }
  async read(key: string, range?: ByteRange, signal?: AbortSignal): Promise<Response> {
    if (!validObjectKey(key)) throw new Error('INVALID_OBJECT_KEY');
    await this.assertPrivate();
    const headers: Record<string, string> = {};
    if (range) headers.Range = `bytes=${range.start}-${range.end}`;
    const response = await this.request(`/object/authenticated/juyu-private/${key}`, { headers, signal });
    if (![200, 206].includes(response.status)) { await response.body?.cancel(); throw new Error('PRIVATE_OBJECT_UNAVAILABLE'); }
    return response;
  }
  async remove(key: string, signal?: AbortSignal): Promise<void> {
    if (!validObjectKey(key)) throw new Error('INVALID_OBJECT_KEY');
    // One deadline includes private-bucket checks, deletion and absence verification.
    const timeout = AbortSignal.timeout(10_000);
    const operationSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    operationSignal.throwIfAborted();
    await this.assertPrivate(operationSignal);
    const removed = await this.request('/object/juyu-private', {
      method: 'DELETE', signal: operationSignal,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [key] }),
    });
    await removed.body?.cancel();
    // A retry may encounter an already absent object, but still requires the read check below.
    if (!removed.ok && removed.status !== 404) throw new Error('PRIVATE_OBJECT_DELETE_FAILED');
    await this.assertPrivate(operationSignal);
    const remaining = await this.request(`/object/authenticated/juyu-private/${key}`, {
      headers: { Range: 'bytes=0-0' }, signal: operationSignal,
    });
    if (!await confirmsObjectAbsence(remaining)) throw new Error('PRIVATE_OBJECT_DELETE_UNVERIFIED');
    await this.assertPrivate(operationSignal);
  }
  async put(key: string, body: ReadableStream<Uint8Array>, mimeType: string, signal?:AbortSignal) {
    if (!validObjectKey(key)) throw new Error('INVALID_OBJECT_KEY');
    await this.assertPrivate();
    const init: RequestInit & { duplex: 'half' } = { method: 'POST', body, signal, duplex: 'half', headers: { 'Content-Type': mimeType, 'x-upsert': 'false', 'Cache-Control': 'max-age=0' } };
    const response = await this.request(`/object/juyu-private/${key}`, init);
    if (!response.ok) { await response.body?.cancel(); throw new Error('PRIVATE_OBJECT_UPLOAD_FAILED'); }
    await response.body?.cancel();
  }
}
