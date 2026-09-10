import {normalizeCategoryDefinitions, parseCategoryWrite, type CategoryDefinition, type CategoryWrite} from './model.ts';

export class CategoryWriteRejected extends Error {}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const rejectionCodes = new Set(['CATEGORY_CONFLICT', 'CATEGORY_LIMIT', 'CATEGORY_CYCLE', 'CATEGORY_DEPTH', 'INVALID_INPUT', 'FORBIDDEN']);

function definitions(value: unknown): CategoryDefinition[] {
  try { return normalizeCategoryDefinitions(value); }
  catch { throw new Error('INVALID_ACK'); }
}

export async function readCategories(): Promise<CategoryDefinition[]> {
  const response = await fetch('/api/admin/categories', {
    cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(response.status === 403 ? 'FORBIDDEN' : 'CATEGORIES_UNAVAILABLE');
  return definitions(await response.json());
}

export async function saveCategory(id: string, input: CategoryWrite): Promise<CategoryDefinition> {
  let write: CategoryWrite;
  try {
    if (!uuid.test(id)) throw new Error('INVALID_INPUT');
    write = parseCategoryWrite(input);
  } catch { throw new CategoryWriteRejected('INVALID_INPUT'); }
  const response = await fetch(`/api/admin/categories/${encodeURIComponent(id)}`, {
    method: 'PUT', credentials: 'same-origin', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(write), signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    if (response.status >= 400 && response.status < 500) {
      const body = await response.json().catch(() => null);
      const fallback = response.status === 403 ? 'FORBIDDEN' : response.status === 409 ? 'CATEGORY_CONFLICT' : 'WRITE_REJECTED';
      throw new CategoryWriteRejected(rejectionCodes.has(body?.error) ? body.error : fallback);
    }
    throw new Error('UNKNOWN_RESULT');
  }
  const saved = definitions([await response.json()])[0];
  if (!saved || saved.id !== id || saved.version !== (write.expectedVersion ?? 0) + 1 ||
      saved.name !== write.name || saved.parentId !== write.parentId || saved.position !== write.position ||
      saved.enabled !== write.enabled || saved.audience !== write.audience) {
    throw new Error('INVALID_ACK');
  }
  return saved;
}
