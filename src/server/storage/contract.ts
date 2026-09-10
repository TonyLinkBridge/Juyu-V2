export interface AssetFile {
  id: string;
  document_id: string;
  filename: string;
  mime_type: string;
  byte_size: string | number;
  bucket: string;
  object_key: string;
}
export interface ByteRange { start: number; end: number }
export interface PrivateStorage {
  /** Resolves only after authenticated absence verification; unsupported providers leave cleanup pending. */
  remove?(key: string, signal?: AbortSignal): Promise<void>;
  read(key: string, range?: ByteRange, signal?: AbortSignal): Promise<Response>;
  put(key: string, body: ReadableStream<Uint8Array>, mimeType: string, signal?:AbortSignal): Promise<void>;
}
export function validObjectKey(key: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(key);
}
export function validateAsset(asset: AssetFile): number {
  const size = Number(asset.byte_size);
  if (!validObjectKey(asset.id) || asset.object_key !== asset.id || asset.bucket !== 'juyu-private'
    || !Number.isSafeInteger(size) || size < 0 || typeof asset.filename !== 'string'
    || typeof asset.mime_type !== 'string' || typeof asset.document_id !== 'string') throw new Error('INVALID_ASSET');
  return size;
}
