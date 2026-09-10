import {normalizeFieldDefinitions, parseFieldWrite, type FieldDefinition, type FieldWrite} from './model.ts';

export class FieldWriteRejected extends Error {}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const rejectionCodes = new Set(['FIELD_CONFLICT', 'FIELD_LIMIT', 'INVALID_INPUT', 'FORBIDDEN']);

function definitions(value: unknown): FieldDefinition[] {
  try { return normalizeFieldDefinitions(value); }
  catch { throw new Error('INVALID_ACK'); }
}

export async function readFields(): Promise<FieldDefinition[]> {
  const response = await fetch('/api/admin/fields', {
    cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(response.status === 403 ? 'FORBIDDEN' : 'FIELDS_UNAVAILABLE');
  return definitions(await response.json());
}

export async function saveField(id: string, input: FieldWrite): Promise<FieldDefinition> {
  let write: FieldWrite;
  try {
    if (!uuid.test(id)) throw new Error('INVALID_INPUT');
    write = parseFieldWrite(input);
  } catch { throw new FieldWriteRejected('INVALID_INPUT'); }
  const response = await fetch(`/api/admin/fields/${encodeURIComponent(id)}`, {
    method: 'PUT', credentials: 'same-origin', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(write), signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    if (response.status >= 400 && response.status < 500) {
      const body = await response.json().catch(() => null);
      const fallback = response.status === 403 ? 'FORBIDDEN' : response.status === 409 ? 'FIELD_CONFLICT' : 'WRITE_REJECTED';
      throw new FieldWriteRejected(rejectionCodes.has(body?.error) ? body.error : fallback);
    }
    throw new Error('UNKNOWN_RESULT');
  }
  const saved = definitions([await response.json()])[0];
  if (!saved || saved.id !== id || saved.version !== (write.expectedVersion ?? 0) + 1 ||
      saved.name !== write.name || saved.type !== write.type || saved.required !== write.required ||
      saved.enabled !== write.enabled || JSON.stringify(saved.options) !== JSON.stringify(write.options)) {
    throw new Error('INVALID_ACK');
  }
  return saved;
}
