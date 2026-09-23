import type { Audience, Document, Viewer } from '../src/domain/model.ts';

export const now = '2026-09-08T03:00:00.000Z';
export const support: Viewer = { id: 'support-1', role: 'support', companyVerified: true };
export const ops: Viewer = { id: 'ops-1', role: 'ops', companyVerified: true };
export const adminA: Viewer = { id: 'admin-a', role: 'admin', companyVerified: true };
export const adminB: Viewer = { id: 'admin-b', role: 'admin', companyVerified: true };
export const adminC: Viewer = { id: 'admin-c', role: 'admin', companyVerified: true };

export function publishedDocument(audience: Audience = 'staff'): Document {
  return {
    id: 'doc-1', kind: 'article', sequence: 4, lifecycle: 'active', publishedRevisionId: 1,
    revisions: [{ id: 1, title: '正式标题', body: '旧正式内容', audience, authorId: 'admin-a', editorId: 'admin-a', createdAt: now }],
    workflow: { revisionId: 1, status: 'published', approvalMode:'standard', submittedBy: 'admin-a', reviewerId: 'admin-b', approvedBy: 'admin-b' },
    audit: [],
  };
}
