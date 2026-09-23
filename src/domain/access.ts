import type { Document, Revision, Role, Viewer } from './model.ts';

export function parseRole(value: unknown): Role | null {
  return value === 'support' || value === 'ops' || value === 'admin' || value === 'super_admin' ? value : null;
}

export function isVerified(viewer: Viewer | null): viewer is Viewer & { role: Role } {
  return viewer !== null && typeof viewer.id === 'string' && viewer.id.trim().length > 0
    && viewer.companyVerified === true && parseRole(viewer.role) !== null;
}

export function isAdministratorRole(role: Role | null): boolean {
  return role === 'admin' || role === 'super_admin';
}

export function isSuperAdmin(viewer: Viewer | null): boolean {
  return isVerified(viewer) && viewer.role === 'super_admin';
}

export function canManage(viewer: Viewer | null): boolean {
  return isVerified(viewer) && isAdministratorRole(viewer.role);
}

export function readPublished(viewer: Viewer | null, document: Document): Revision | null {
  if (!isVerified(viewer) || document.lifecycle !== 'active' || document.publishedRevisionId === null) return null;
  if (document.kind === 'ops' && viewer.role === 'support') return null;
  const revision = document.revisions.find((item) => item.id === document.publishedRevisionId);
  if (!revision) return null;
  const allowed = revision.audience === 'staff'
    || (revision.audience === 'ops' && (viewer.role === 'ops' || isAdministratorRole(viewer.role)))
    || (revision.audience === 'admin' && isAdministratorRole(viewer.role));
  return allowed ? structuredClone(revision) : null;
}

// The asset association must be loaded from storage metadata, never accepted from the client.
export function canReadAsset(viewer: Viewer | null, document: Document, asset: { documentId: string; revisionId: number }): boolean {
  const revision = readPublished(viewer, document);
  return revision !== null && document.id === asset.documentId && revision.id === asset.revisionId;
}

export function searchProjection(viewer: Viewer | null, documents: Document[]): { documentId: string; title: string; body: string; revisionId: number }[] {
  return documents.flatMap((document) => {
    const revision = readPublished(viewer, document);
    return revision ? [{ documentId: document.id, title: revision.title, body: revision.body, revisionId: revision.id }] : [];
  });
}
