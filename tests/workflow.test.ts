import assert from 'node:assert/strict';
import test from 'node:test';
import { canReadAsset, readPublished } from '../src/domain/access.ts';
import type { Document, Viewer } from '../src/domain/model.ts';
import { createDocument, transition } from '../src/domain/workflow.ts';
import type { Command } from '../src/domain/workflow.ts';
import { adminA, adminB, adminC, now, ops, support } from './fixtures.ts';

const input = { id: 'doc-1', title: '说明', body: '旧正式内容', audience: 'staff', kind: 'article' } as const;
const edit: Command = { type: 'edit', title: '新标题', body: '新稿内容', audience: 'staff' };
const create = () => createDocument(input, adminA, now);
const run = (doc: Document, command: Command, actor: Viewer = adminA, reviewer?: Viewer) =>
  transition(doc, command, actor, { expectedSequence: doc.sequence, now, reviewer });
const submitted = () => run(create(), { type: 'submit' }, adminA, adminB);
const approved = () => run(submitted(), { type: 'approve' }, adminB);
const published = () => run(run(approved(), { type: 'queue' }), { type: 'publish' });
const superAdmin:Viewer={id:'super-a',role:'super_admin',companyVerified:true};

test('new documents are private drafts and record the creator', () => {
  const doc = create();
  assert.equal(doc.workflow.status, 'draft');
  assert.equal(doc.publishedRevisionId, null);
  assert.equal(doc.sequence, 0);
  assert.equal(doc.revisions[0].authorId, 'admin-a');
  assert.equal(doc.audit[0].action, 'create');
  assert.equal(readPublished(support, doc), null);
});

for (const actor of [support, ops, { ...adminA, companyVerified: false }, { ...adminA, role: null }, null]) {
  test(`creation denies ${actor?.role ?? 'unknown'} with verified=${actor?.companyVerified ?? false}`, () => {
    assert.throws(() => createDocument(input, actor, now), /FORBIDDEN/);
  });
}

test('empty content identifiers and invalid visibility are rejected', () => {
  assert.throws(() => createDocument({ ...input, id: ' ' }, adminA, now), /INVALID_CONTENT/);
  assert.throws(() => createDocument({ ...input, title: ' ' }, adminA, now), /INVALID_CONTENT/);
  assert.throws(() => createDocument({ ...input, audience: 'public' as 'staff' }, adminA, now), /INVALID_CONTENT/);
  assert.throws(() => createDocument({ ...input, kind: 'ops', audience: 'staff' }, adminA, now), /INVALID_CONTENT/);
});

test('submitting binds a concrete revision and another verified Admin', () => {
  const doc = submitted();
  assert.equal(doc.workflow.status, 'in_review');
  assert.equal(doc.workflow.reviewerId, 'admin-b');
  assert.equal(doc.workflow.submittedBy, 'admin-a');
  assert.equal(doc.workflow.revisionId, 1);
  assert.equal(doc.workflow.approvedBy, null);
  assert.equal(doc.sequence, 1);
});

test('submission cannot choose self, an employee, an unverified account or no reviewer', () => {
  for (const reviewer of [adminA, support, ops, { ...adminB, companyVerified: false }, undefined]) {
    assert.throws(() => run(create(), { type: 'submit' }, adminA, reviewer), /INVALID_REVIEWER/);
  }
});

test('submitting on behalf of an author cannot select that author as reviewer', () => {
  assert.throws(() => run(create(), { type: 'submit' }, adminC, adminA), /INVALID_REVIEWER/);
});

test('only the assigned current Admin can approve or reject', () => {
  for (const actor of [adminA, adminC, { ...adminB, role: 'support' as const }]) {
    assert.throws(() => run(submitted(), { type: 'approve' }, actor), /FORBIDDEN|NOT_REVIEWER/);
    assert.throws(() => run(submitted(), { type: 'reject', reason: '需要修正' }, actor), /FORBIDDEN|NOT_REVIEWER/);
  }
  const doc = approved();
  assert.equal(doc.workflow.status, 'approved');
  assert.equal(doc.workflow.approvedBy, 'admin-b');
  assert.equal(doc.publishedRevisionId, null);
});

test('rejection requires a reason and resubmission requires a fresh approval', () => {
  assert.throws(() => run(submitted(), { type: 'reject', reason: '   ' }, adminB), /REASON_REQUIRED/);
  const rejected = run(submitted(), { type: 'reject', reason: ' 补充升级处理条件 ' }, adminB);
  assert.equal(rejected.workflow.status, 'changes_requested');
  assert.equal(rejected.audit.at(-1)?.reason, '补充升级处理条件');
  const revised = run(rejected, edit);
  const resubmitted = run(revised, { type: 'submit' }, adminA, adminC);
  assert.equal(resubmitted.workflow.status, 'in_review');
  assert.equal(resubmitted.workflow.approvedBy, null);
  assert.equal(resubmitted.workflow.revisionId, 2);
  assert.throws(() => run(resubmitted, { type: 'approve' }, adminB), /NOT_REVIEWER/);
  assert.equal(run(resubmitted, { type: 'approve' }, adminC).workflow.status, 'approved');
});

test('reviewed content is frozen until withdrawn', () => {
  const doc = submitted();
  const original = structuredClone(doc);
  assert.throws(() => run(doc, edit), /INVALID_STATE/);
  assert.deepEqual(doc, original);
  const withdrawn = run(doc, { type: 'withdraw' });
  assert.equal(withdrawn.workflow.status, 'draft');
  assert.equal(withdrawn.workflow.reviewerId, null);
  assert.equal(run(withdrawn, edit).revisions.length, 2);
});

test('reassigning removes the old reviewer authority and records both reviewers', () => {
  const doc = run(submitted(), { type: 'reassign' }, adminA, adminC);
  assert.throws(() => run(doc, { type: 'approve' }, adminB), /NOT_REVIEWER/);
  assert.equal(run(doc, { type: 'approve' }, adminC).workflow.status, 'approved');
  assert.equal(doc.audit.at(-1)?.previousReviewerId, 'admin-b');
  assert.equal(doc.audit.at(-1)?.reviewerId, 'admin-c');
  assert.throws(() => run(doc, { type: 'reassign' }, adminA, adminA), /INVALID_REVIEWER/);
});

test('the last editor cannot be chosen for secondary review', () => {
  const edited = run(create(), edit, adminB);
  assert.throws(() => run(edited, { type: 'submit' }, adminA, adminB), /INVALID_REVIEWER/);
  assert.equal(run(edited, { type: 'submit' }, adminA, adminC).workflow.reviewerId, 'admin-c');
});

test('reassignment rejects distinct authors, editors, submitters and ineligible accounts', () => {
  const adminD: Viewer = { id: 'admin-d', role: 'admin', companyVerified: true };
  const adminE: Viewer = { id: 'admin-e', role: 'admin', companyVerified: true };
  const edited = run(create(), edit, adminB);
  const doc = run(edited, { type: 'submit' }, adminC, adminD);
  for (const reviewer of [adminA, adminB, adminC, support, ops, { ...adminE, companyVerified: false }]) {
    assert.throws(() => run(doc, { type: 'reassign' }, adminC, reviewer), /INVALID_REVIEWER/);
  }
  assert.equal(run(doc, { type: 'reassign' }, adminC, adminE).workflow.reviewerId, 'admin-e');
});

test('publishing requires approval then explicit publication queue', () => {
  for (const doc of [create(), submitted(), approved()]) {
    assert.throws(() => run(doc, { type: 'publish' }), /INVALID_STATE/);
  }
  assert.throws(() => run(create(), { type: 'queue' }), /INVALID_STATE/);
  assert.throws(() => run(submitted(), { type: 'queue' }), /INVALID_STATE/);
  const queued = run(approved(), { type: 'queue' });
  assert.equal(queued.workflow.status, 'queued');
  assert.equal(queued.publishedRevisionId, null);
  assert.equal(run(queued, { type: 'publish' }).workflow.status, 'published');
  assert.equal(readPublished(support, published())?.body, '旧正式内容');
});

test('Super Admin directly publishes one truthful workflow event without a reason',()=>{
 const own=createDocument(input,superAdmin,now);
 const doc=run(own,{type:'direct_publish'},superAdmin);
 assert.equal(doc.workflow.status,'published');
 assert.equal(doc.workflow.approvalMode,'super_admin');
 assert.equal(doc.workflow.submittedBy,superAdmin.id);
 assert.equal(doc.workflow.reviewerId,superAdmin.id);
 assert.equal(doc.workflow.approvedBy,superAdmin.id);
 assert.equal(doc.publishedRevisionId,1);
 assert.equal(doc.audit.at(-1)?.action,'direct_publish');
 assert.equal(doc.audit.at(-1)?.reason,null);
 assert.throws(()=>run(create(),{type:'direct_publish'},adminA),/FORBIDDEN/);
 assert.throws(()=>run(create(),{type:'direct_publish'},superAdmin),/FORBIDDEN/);
});

test('direct publication accepts a returned draft but requires withdrawal from active review',()=>{
 const own=createDocument(input,superAdmin,now);
 const submittedOwn=run(own,{type:'submit'},superAdmin,adminB);
 const returned=run(submittedOwn,{type:'reject',reason:'补充资料'},adminB);
 assert.equal(run(returned,{type:'direct_publish'},superAdmin).workflow.status,'published');
 assert.throws(()=>run(submitted(),{type:'direct_publish'},superAdmin),/INVALID_STATE/);
 assert.throws(()=>run(published(),{type:'direct_publish'},superAdmin),/INVALID_STATE/);
});

test('new drafts leave the current formal version readable until replacement publishes', () => {
  const old = published();
  let doc = run(old, edit);
  assert.equal(doc.workflow.status, 'draft');
  assert.equal(doc.workflow.revisionId, 2);
  assert.equal(doc.publishedRevisionId, 1);
  assert.equal(readPublished(support, doc)?.body, '旧正式内容');
  assert.equal(old.revisions.length, 1);
  doc = run(doc, { type: 'submit' }, adminA, adminB);
  assert.equal(readPublished(support, doc)?.body, '旧正式内容');
  doc = run(doc, { type: 'approve' }, adminB);
  doc = run(doc, { type: 'queue' });
  assert.equal(readPublished(support, doc)?.body, '旧正式内容');
  doc = run(doc, { type: 'publish' });
  assert.equal(readPublished(support, doc)?.body, '新稿内容');
  assert.equal(doc.publishedRevisionId, 2);
  assert.equal(doc.revisions[0].body, '旧正式内容');
  assert.equal(canReadAsset(support, doc, { documentId: 'doc-1', revisionId: 1 }), false);
});

test('editing an approved or queued version invalidates approval and preserves that snapshot', () => {
  for (const old of [approved(), run(approved(), { type: 'queue' })]) {
    const doc = run(old, edit);
    assert.equal(doc.workflow.status, 'draft');
    assert.equal(doc.workflow.approvedBy, null);
    assert.equal(doc.workflow.submittedBy, null);
    assert.equal(doc.workflow.reviewerId, null);
    assert.equal(doc.revisions[0].body, '旧正式内容');
    assert.equal(doc.revisions[1].body, '新稿内容');
    assert.throws(() => run(doc, { type: 'queue' }), /INVALID_STATE/);
  }
});

test('a visibility change only affects readers when its reviewed revision is published', () => {
  let doc = run(published(), { ...edit, audience: 'ops' });
  assert.equal(readPublished(support, doc)?.body, '旧正式内容');
  doc = run(doc, { type: 'submit' }, adminA, adminB);
  doc = run(doc, { type: 'approve' }, adminB);
  doc = run(run(doc, { type: 'queue' }), { type: 'publish' });
  assert.equal(readPublished(support, doc), null);
  assert.equal(readPublished(ops, doc)?.body, '新稿内容');
});

test('stale or repeated commands cannot change the document or add history', () => {
  const doc = submitted();
  const before = structuredClone(doc);
  assert.throws(() => transition(doc, { type: 'approve' }, adminB, { expectedSequence: 0, now }), /CONFLICT/);
  assert.deepEqual(doc, before);
  const approvedDoc = run(doc, { type: 'approve' }, adminB);
  assert.throws(() => run(approvedDoc, { type: 'approve' }, adminB), /INVALID_STATE/);
});

test('employees cannot bypass the workflow through any command', () => {
  const cases: [Document, Command][] = [
    [create(), edit], [create(), { type: 'submit' }], [submitted(), { type: 'withdraw' }],
    [submitted(), { type: 'reassign' }], [submitted(), { type: 'reject', reason: '修改' }],
    [submitted(), { type: 'approve' }], [approved(), { type: 'queue' }],
    [run(approved(), { type: 'queue' }), { type: 'publish' }],
  ];
  for (const actor of [support, ops, { ...adminA, companyVerified: false }]) {
    for (const [doc, command] of cases) {
      assert.throws(() => run(doc, command, actor, adminB), /FORBIDDEN/);
    }
  }
});

test('archived or deleted content cannot be edited or republished through regular commands', () => {
  for (const lifecycle of ['archived', 'trashed'] as const) {
    assert.throws(() => run({ ...published(), lifecycle }, edit), /INACTIVE_DOCUMENT/);
    assert.throws(() => run({ ...run(approved(), { type: 'queue' }), lifecycle }, { type: 'publish' }), /INACTIVE_DOCUMENT/);
  }
});

test('every successful transition keeps an immutable audit trail bound to its version', () => {
  const doc = run(published(), edit);
  assert.deepEqual(doc.audit.map((item) => item.action), ['create', 'submit', 'approve', 'queue', 'publish', 'edit']);
  assert.deepEqual(doc.audit.map((item) => item.sequence), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(doc.audit.map((item) => item.actorId), ['admin-a', 'admin-a', 'admin-b', 'admin-a', 'admin-a', 'admin-a']);
  assert.deepEqual(doc.audit.map((item) => item.revisionId), [1, 1, 1, 1, 1, 2]);
  assert.ok(doc.audit.every((item) => item.at === now));
});

test('unknown commands and inconsistent approval records fail closed', () => {
  assert.throws(() => run(create(), { type: 'set_status', status: 'published' } as unknown as Command), /INVALID_COMMAND/);
  const queued = run(approved(), { type: 'queue' });
  queued.workflow.approvedBy = 'admin-c';
  assert.throws(() => run(queued, { type: 'publish' }), /INVALID_APPROVAL/);
});
