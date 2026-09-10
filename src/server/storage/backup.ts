import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile, rm, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { validateAsset } from './contract.ts';
import type { AssetFile, PrivateStorage } from './contract.ts';

type Entry = AssetFile & { sha256: string };
async function checksum(path: string) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error('BACKUP_INTEGRITY');
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return { sha256: hash.digest('hex'), size: info.size };
}
/** Operator-only. Pass the complete ready/quarantined asset inventory from a consistent DB backup. */
export async function backupFiles(store: PrivateStorage, assets: AssetFile[], destination: string) {
  const ids = new Set<string>();
  for (const asset of assets) { validateAsset(asset); if (ids.has(asset.id)) throw new Error('DUPLICATE_ASSET'); ids.add(asset.id); }
  await mkdir(destination, { mode: 0o700 }); // Never overwrite an existing backup directory.
  try {
    const files: Entry[] = [];
    for (const asset of assets) {
      const response = await store.read(asset.object_key);
      if (response.status !== 200 || !response.body) throw new Error('BACKUP_READ_FAILED');
      let size = 0; const hash = createHash('sha256');
      const meter = new Transform({ transform(chunk, _encoding, done) { size += chunk.length; hash.update(chunk); done(null, chunk); } });
      await pipeline(Readable.fromWeb(response.body as import('node:stream/web').ReadableStream), meter, createWriteStream(join(destination, asset.id), { flags: 'wx', mode: 0o600 }));
      if (size !== Number(asset.byte_size)) throw new Error('BACKUP_INTEGRITY');
      files.push({ ...asset, sha256: hash.digest('hex') });
    }
    await writeFile(join(destination, 'manifest.json'), JSON.stringify({ version: 1, createdAt: new Date().toISOString(), files }, null, 2), { flag: 'wx', mode: 0o600 });
  } catch (error) { await rm(destination, { recursive: true, force: true }); throw error; }
}
export async function restoreFiles(store: PrivateStorage, source: string) {
  const manifest = JSON.parse(await readFile(join(source, 'manifest.json'), 'utf8'));
  if (manifest?.version !== 1 || !Array.isArray(manifest.files)) throw new Error('BACKUP_INTEGRITY');
  const files = manifest.files as Entry[], ids = new Set<string>();
  // Validate the entire backup before writing the first destination object.
  for (const entry of files) {
    validateAsset(entry);
    if (ids.has(entry.id) || typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error('BACKUP_INTEGRITY');
    ids.add(entry.id);
    const actual = await checksum(join(source, entry.id));
    if (actual.size !== Number(entry.byte_size) || actual.sha256 !== entry.sha256) throw new Error('BACKUP_INTEGRITY');
  }
  for (const entry of files) {
    await store.put(entry.object_key, Readable.toWeb(createReadStream(join(source, entry.id))) as ReadableStream<Uint8Array>, entry.mime_type);
    const restored = await store.read(entry.object_key);
    if (restored.status !== 200 || !restored.body) throw new Error('BACKUP_RESTORE_VERIFY_FAILED');
    const hash = createHash('sha256'); let size = 0;
    for await (const chunk of Readable.fromWeb(restored.body as import('node:stream/web').ReadableStream)) { size += chunk.length; hash.update(chunk); }
    if (size !== Number(entry.byte_size) || hash.digest('hex') !== entry.sha256) throw new Error('BACKUP_RESTORE_VERIFY_FAILED');
  }
}
