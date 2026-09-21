import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { temporaryDatabase, ownerTransactions } from './fixture.ts';
import { migrate } from '../../src/server/database/migrate.ts';
import { DocumentRepository } from '../../src/server/database/repository.ts';
import { readPublished } from '../../src/domain/access.ts';
import type { Viewer, Document } from '../../src/domain/model.ts';
import type { Command } from '../../src/domain/workflow.ts';

let fixture: Awaited<ReturnType<typeof temporaryDatabase>>;
let repository: DocumentRepository;
const admin = (id: string): Viewer => ({ id, role: 'admin', companyVerified: true });
const a = admin('admin-a'), b = admin('admin-b'), c = admin('admin-c');
const staff: Viewer = { id: 'staff', role: 'support', companyVerified: true };
let id = 0;
async function draft() {
  return repository.create({ id: `doc-${++id}`, kind: 'article', title: '中文资料', body: '正式正文', audience: 'staff' }, a);
}
async function act(document: Document, command: Command, actor = a, reviewer?: Viewer) {
  return repository.execute(document.id, command, actor, { expectedSequence: document.sequence, reviewer });
}
async function queued() {
  let document = await draft();
  document = await act(document, { type: 'submit' }, a, b);
  document = await act(document, { type: 'approve' }, b);
  return act(document, { type: 'queue' });
}

before(async () => {
  fixture = await temporaryDatabase();
  await migrate(fixture.pool);
  await fixture.pool.query("INSERT INTO juyu.members (clerk_user_id, display_name) VALUES ('admin-a','A'),('admin-b','B'),('admin-c','C'),('staff','Support')");
  repository = new DocumentRepository(ownerTransactions(fixture.pool));
});
after(async () => { if (fixture) await fixture.close(); });

test('empty database migration is replayable without losing data', async () => {
  assert.deepEqual(await migrate(fixture.pool), []);
  assert.equal((await fixture.pool.query('SELECT count(*)::int AS n FROM juyu.members')).rows[0].n, 4);
  assert.equal((await fixture.pool.query('SELECT count(*)::int AS n FROM juyu.schema_migrations')).rows[0].n, 41);
});

test('complete review/publish cycle persists old publication while new draft waits', async () => {
  let document = await queued();
  document = await act(document, { type: 'publish' });
  const published = await repository.getForManagement(document.id, a);
  assert.deepEqual(published, document);
  const edited = await act(document, { type: 'edit', title: '未审核', body: '新草稿', audience: 'staff' });
  assert.equal(edited.workflow.status, 'draft');
  assert.equal(edited.workflow.approvedBy, null);
  assert.equal(readPublished(staff, edited)?.body, '正式正文');
  assert.equal(edited.revisions.length, 2);
  assert.equal(edited.audit.at(-1)?.action, 'edit');
  let next = await act(edited, { type: 'submit' }, a, b);
  next = await act(next, { type: 'approve' }, b);
  next = await act(next, { type: 'queue' });
  next = await act(next, { type: 'publish' });
  assert.equal(readPublished(staff, next)?.body, '新草稿');
  assert.equal((await fixture.pool.query('SELECT count(*)::int AS n FROM juyu.reviews WHERE document_id=$1', [document.id])).rows[0].n, 2);
});

test('reviewer reassignment, rejection and resubmission retain each round', async () => {
  let document = await draft();
  document = await act(document, { type: 'submit' }, a, b);
  await assert.rejects(act(document, { type: 'approve' }, c), /NOT_REVIEWER/);
  await assert.rejects(act(document, { type: 'edit', title: 'x', body: 'x', audience: 'staff' }), /INVALID_STATE/);
  document = await act(document, { type: 'reassign' }, a, c);
  await assert.rejects(act(document, { type: 'approve' }, b), /NOT_REVIEWER/);
  document = await act(document, { type: 'reject', reason: '请补充' }, c);
  document = await act(document, { type: 'submit' }, a, b);
  document = await act(document, { type: 'withdraw' });
  const reviews = (await fixture.pool.query('SELECT status, reason, reviewer_id FROM juyu.reviews WHERE document_id=$1 ORDER BY submitted_sequence', [document.id])).rows;
  assert.deepEqual(reviews, [{ status: 'rejected', reason: '请补充', reviewer_id: c.id }, { status: 'withdrawn', reason: null, reviewer_id: b.id }]);
  assert.equal(document.audit.find((entry) => entry.action === 'reassign')?.previousReviewerId, b.id);
});

test('management entry denies Support, unverified and self review', async () => {
  const document = await draft();
  await assert.rejects(repository.getForManagement(document.id, staff), /FORBIDDEN/);
  await assert.rejects(act(document, { type: 'submit' }, a, a), /INVALID_REVIEWER/);
  await assert.rejects(act(document, { type: 'submit' }, a, { ...b, companyVerified: false }), /INVALID_REVIEWER/);
  await assert.rejects(act(document, { type: 'edit', title: 'x', body: 'x', audience: 'staff' }, staff), /FORBIDDEN/);
  assert.equal((await repository.getForManagement(document.id, a))?.sequence, 0);
});

test('disabled actor or designated reviewer cannot perform new writes', async () => {
  const document = await draft();
  await fixture.pool.query('UPDATE juyu.members SET disabled_at=now() WHERE clerk_user_id=$1', [c.id]);
  try {
    await assert.rejects(act(document, { type: 'submit' }, a, c), /INACTIVE_MEMBER/);
    await assert.rejects(act(document, { type: 'submit' }, c, b), /INACTIVE_MEMBER/);
  } finally {
    await fixture.pool.query('UPDATE juyu.members SET disabled_at=null WHERE clerk_user_id=$1', [c.id]);
  }
});

for (const operation of ['edit', 'publish'] as const) {
  test(`two simultaneous ${operation} operations have exactly one winner`, async () => {
    const document = operation === 'publish' ? await queued() : await draft();
    const command: Command = operation === 'publish' ? { type: 'publish' } : { type: 'edit', title: '新', body: '新', audience: 'staff' };
    // Hold a separate connection's row lock until both writes are actually waiting in PostgreSQL.
    const blocker = await fixture.pool.connect();
    await blocker.query('BEGIN');
    await blocker.query('SELECT id FROM juyu.documents WHERE id=$1 FOR UPDATE', [document.id]);
    const writes = Promise.allSettled([act(document, command), act(document, command)]);
    try {
      const deadline = Date.now() + 5000;
      let waiting = 0;
      while (Date.now() < deadline) {
        waiting = (await fixture.pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE 'SELECT id FROM juyu.documents%' ")).rows[0].n;
        if (waiting >= 2) break;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.equal(waiting, 2, 'two independent database connections must overlap');
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
    }
    const results = await writes;
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    const failure = results.find((r) => r.status === 'rejected');
    assert.ok(failure?.status === 'rejected');
    assert.match(String(failure.reason), /CONFLICT/);
    const saved = await repository.getForManagement(document.id, a);
    assert.equal(saved?.sequence, document.sequence + 1);
    assert.equal(saved?.audit.length, document.audit.length + 1);
    assert.equal(saved?.revisions.length, document.revisions.length + (operation === 'edit' ? 1 : 0));
  });
}

test('injected audit failure rolls back state, revision, review and publication together', async () => {
  const documents = [await draft(), await draft(), await queued()];
  await fixture.pool.query("CREATE FUNCTION juyu.test_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected audit failure'; END $$; CREATE TRIGGER test_fail BEFORE INSERT ON juyu.audit_log FOR EACH ROW EXECUTE FUNCTION juyu.test_fail_audit()");
  try {
    const commands: Command[] = [{ type: 'edit', title: 'bad', body: 'bad', audience: 'staff' }, { type: 'submit' }, { type: 'publish' }];
    for (let index = 0; index < documents.length; index++) {
      const document = documents[index];
      const reviews = (await fixture.pool.query('SELECT * FROM juyu.reviews WHERE document_id=$1', [document.id])).rows;
      await assert.rejects(act(document, commands[index], a, b), /injected audit failure/);
      assert.deepEqual(await repository.getForManagement(document.id, a), document);
      assert.deepEqual((await fixture.pool.query('SELECT * FROM juyu.reviews WHERE document_id=$1', [document.id])).rows, reviews);
    }
  } finally {
    await fixture.pool.query('DROP TRIGGER test_fail ON juyu.audit_log; DROP FUNCTION juyu.test_fail_audit()');
  }
});

test('database refuses rewriting immutable versions and audit or cross-document pointers', async () => {
  const first = await draft(), second = await draft();
  await assert.rejects(fixture.pool.query("UPDATE juyu.revisions SET body='tamper' WHERE document_id=$1", [first.id]), /IMMUTABLE/);
  await assert.rejects(fixture.pool.query('DELETE FROM juyu.audit_log WHERE document_id=$1', [first.id]), /IMMUTABLE/);
  await act(second, { type: 'edit', title: 'x', body: 'x', audience: 'staff' });
  await assert.rejects(fixture.pool.query('UPDATE juyu.documents SET published_revision_id=2 WHERE id=$1', [first.id]));
  assert.deepEqual(await repository.getForManagement(first.id, a), first);
});

test('untrusted SQL role cannot read private data even if table SELECT was accidentally granted', async () => {
  await fixture.pool.query('CREATE ROLE test_untrusted NOLOGIN; GRANT USAGE ON SCHEMA juyu TO test_untrusted; GRANT SELECT ON ALL TABLES IN SCHEMA juyu TO test_untrusted');
  const client = await fixture.pool.connect();
  try {
    await client.query('SET ROLE test_untrusted');
    for (const table of ['members', 'documents', 'revisions', 'reviews', 'audit_log']) {
      assert.equal((await client.query(`SELECT count(*)::int AS n FROM juyu.${table}`)).rows[0].n, 0);
    }
  } finally {
    await client.query('RESET ROLE');
    client.release();
  }
});

test('migration rollback and reapply is exercised only on a separate disposable cluster', async () => {
  const isolated = await temporaryDatabase();
  try {
    assert.equal((await migrate(isolated.pool)).length, 41);
    // This pool is created above, never obtained from DATABASE_URL or a real Supabase project.
    await isolated.pool.query('DROP SCHEMA juyu CASCADE');
    assert.equal((await migrate(isolated.pool)).length, 41);
    assert.equal((await isolated.pool.query('SELECT count(*)::int AS n FROM juyu.documents')).rows[0].n, 0);
  } finally { await isolated.close(); }
});


test('finalized review evidence cannot be changed or deleted independently', async () => {
  const document = await act(await queued(), { type: 'publish' });
  await assert.rejects(fixture.pool.query("DELETE FROM juyu.reviews WHERE document_id=$1", [document.id]), /IMMUTABLE/);
  await assert.rejects(fixture.pool.query("UPDATE juyu.reviews SET reviewer_id=$2,decided_by=$2 WHERE document_id=$1", [document.id, c.id]), /IMMUTABLE/);
  assert.deepEqual(await repository.getForManagement(document.id, a), document);
});

test('migration checksum mismatch fails without modifying business records', async () => {
  const checksum = (await fixture.pool.query("SELECT checksum FROM juyu.schema_migrations WHERE version='0001_core'")).rows[0].checksum;
  await fixture.pool.query("UPDATE juyu.schema_migrations SET checksum='changed' WHERE version='0001_core'");
  try {
    await assert.rejects(migrate(fixture.pool), /MIGRATION_CHANGED/);
    assert.equal((await fixture.pool.query('SELECT count(*)::int AS n FROM juyu.members')).rows[0].n, 4);
  } finally {
    await fixture.pool.query("UPDATE juyu.schema_migrations SET checksum=$1 WHERE version='0001_core'", [checksum]);
  }
});
