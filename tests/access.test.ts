import assert from 'node:assert/strict';
import test from 'node:test';
import { canManage, canReadAsset, isAdministratorRole, isSuperAdmin, parseRole, readPublished, searchProjection } from '../src/domain/access.ts';
import type { Audience, Viewer } from '../src/domain/model.ts';
import { adminA, ops, publishedDocument, support } from './fixtures.ts';

const superAdmin:Viewer={id:'super-1',role:'super_admin',companyVerified:true};

test('Clerk role metadata recognizes Super Admin as an exact configured role', () => {
  for (const role of ['support', 'ops', 'admin', 'super_admin']) assert.equal(parseRole(role), role);
  for (const value of ['trainer', 'Admin', '', null, undefined, {}, ['admin']]) assert.equal(parseRole(value), null);
  assert.equal(isAdministratorRole('super_admin'),true);
  assert.equal(isSuperAdmin(superAdmin),true);
  assert.equal(isSuperAdmin(adminA),false);
});

const matrix: [Viewer, Audience, boolean][] = [
  [support, 'staff', true], [support, 'ops', false], [support, 'admin', false],
  [ops, 'staff', true], [ops, 'ops', true], [ops, 'admin', false],
  [adminA, 'staff', true], [adminA, 'ops', true], [adminA, 'admin', true],
  [superAdmin, 'staff', true], [superAdmin, 'ops', true], [superAdmin, 'admin', true],
];
for (const [viewer, audience, allowed] of matrix) {
  test(`${viewer.role} reading ${audience} published content: ${allowed}`, () => {
    assert.equal(readPublished(viewer, publishedDocument(audience))?.body ?? null, allowed ? '旧正式内容' : null);
  });
}

test('missing identity, empty id, unverified company and unknown roles are denied', () => {
  const invalid: (Viewer | null)[] = [null, { ...adminA, id: '' }, { ...adminA, companyVerified: false }, { ...adminA, role: null }, { ...adminA, role: 'trainer' as Viewer['role'] }];
  for (const viewer of invalid) {
    assert.equal(readPublished(viewer, publishedDocument()), null);
    assert.equal(canManage(viewer), false);
  }
  assert.equal(canManage(support), false);
  assert.equal(canManage(ops), false);
  assert.equal(canManage(adminA), true);
  assert.equal(canManage(superAdmin), true);
});

test('archived, trashed and unpublished documents disappear even for an Admin reader', () => {
  for (const lifecycle of ['archived', 'trashed'] as const) {
    assert.equal(readPublished(adminA, { ...publishedDocument(), lifecycle }), null);
  }
  assert.equal(readPublished(adminA, { ...publishedDocument(), publishedRevisionId: null }), null);
  assert.equal(readPublished(adminA, { ...publishedDocument(), publishedRevisionId: 999 }), null);
});

test('a confidential new draft does not replace the readable published version', () => {
  const doc = publishedDocument();
  doc.revisions.push({ ...doc.revisions[0], id: 2, title: '保密草稿', body: '保密正文', audience: 'ops' });
  doc.workflow = { revisionId: 2, status: 'in_review', reviewerId: 'admin-b', submittedBy: 'admin-a', approvedBy: null };
  assert.equal(readPublished(support, doc)?.body, '旧正式内容');
  assert.deepEqual(searchProjection(support, [doc]), [{ documentId: 'doc-1', title: '正式标题', body: '旧正式内容', revisionId: 1 }]);
  assert.equal(canReadAsset(support, doc, { documentId: 'doc-1', revisionId: 2 }), false);
});

test('a staff draft cannot open access to a published OPS document', () => {
  const doc = publishedDocument('ops');
  doc.revisions.push({ ...doc.revisions[0], id: 2, audience: 'staff' });
  doc.workflow.revisionId = 2;
  doc.workflow.status = 'draft';
  assert.equal(readPublished(support, doc), null);
  assert.deepEqual(searchProjection(support, [doc]), []);
});

test('OPS content is denied to Support even if its audience is accidentally marked staff', () => {
  assert.equal(readPublished(support, { ...publishedDocument(), kind: 'ops' }), null);
});

test('asset access requires the same document, current published version and viewer permission', () => {
  const doc = publishedDocument('ops');
  assert.equal(canReadAsset(ops, doc, { documentId: 'doc-1', revisionId: 1 }), true);
  assert.equal(canReadAsset(support, doc, { documentId: 'doc-1', revisionId: 1 }), false);
  assert.equal(canReadAsset(adminA, doc, { documentId: 'doc-other', revisionId: 1 }), false);
  assert.equal(canReadAsset(adminA, doc, { documentId: 'doc-1', revisionId: 2 }), false);
  assert.equal(canReadAsset(null, doc, { documentId: 'doc-1', revisionId: 1 }), false);
});

test('search excludes unauthorized, trashed and unpublished documents without title leakage', () => {
  const restricted = publishedDocument('ops');
  restricted.id = 'restricted';
  assert.deepEqual(searchProjection(support, [restricted, { ...publishedDocument(), lifecycle: 'trashed' }, { ...publishedDocument(), publishedRevisionId: null }]), []);
});

test('reader output cannot mutate the stored revision', () => {
  const doc = publishedDocument();
  const revision = readPublished(support, doc);
  assert.ok(revision);
  revision.body = '意外覆盖';
  assert.equal(doc.revisions[0].body, '旧正式内容');
});
