# Super Admin Direct Publication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a truthful `super_admin` role that inherits Admin access and may atomically approve and publish its own current saved revision without entering a reason.

**Architecture:** Extend the verified role model and PostgreSQL row-level rules first, then add one explicit `direct_publish` domain command through the existing publication API. Keep standard two-person review unchanged, persist direct publication as a distinct approval mode and immutable audit event, and expose it only when a freshly verified Super Admin is acting on a current draft.

**Tech Stack:** Next.js 16.3.4, React 19.2.8, TypeScript, PostgreSQL RLS and PL/pgSQL migrations, Clerk public metadata, Node test runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-23-super-admin-direct-publish-design.md`

## Global Constraints

- Use Node `24.19.0` for every acceptance command.
- Do not use subagents; execute every task in the current Codex task.
- `super_admin` inherits every existing Admin capability; existing Admin permissions are not removed.
- Ordinary Admin self-review remains forbidden.
- Direct publication has one confirmation and no reason field.
- Direct publication must be one transaction and one immutable `direct_publish` audit event.
- Do not fabricate an independent reviewer or rewrite existing review history.
- Existing content, private-asset, language, media-readiness, session and optimistic-sequence checks remain mandatory.
- Existing rows remain standard-review rows after migration.

## Review Focus

- A role changed from `super_admin` to `admin` between page load and confirmation must receive `FORBIDDEN` and commit nothing; Task 4 adds the database concurrency test.
- A direct-publish retry after a lost response must return the original acknowledgement without another audit event or timestamp; Task 4 adds the exact-retry test.
- A stored navigation entry containing only `admin` must remain visible to `super_admin`; Task 1 adds the navigation inheritance test.
- A final active Super Admin downgrade or disable attempt must fail while a second active Super Admin allows the operation; Task 2 adds both database cases.
- An English draft without explicit natural-English confirmation must not publish directly; Task 4 adds the server and browser tests.

---

### Task 1: Verified role inheritance across domain, database and navigation

**Files:**
- Create: `src/server/database/migrations/0043_super_admin_role.sql`
- Modify: `src/domain/model.ts`
- Modify: `src/domain/access.ts`
- Modify: `src/navigation-settings/model.ts`
- Modify: `src/components/navigation-settings/NavigationSettings.tsx`
- Modify: `src/components/shell/AccountControls.tsx`
- Modify: `src/server/authentication/admin.ts`
- Modify: `src/server/ops/repository.ts`
- Test: `tests/access.test.ts`
- Test: `tests/navigation-settings-client.test.ts`
- Test: `tests/database/permission-matrix.test.ts`

**Interfaces:**
- Produces: `Role = 'support'|'ops'|'admin'|'super_admin'`, `isAdministrator(viewer): boolean`, `isSuperAdmin(viewer): boolean`, PostgreSQL `juyu.is_admin()` with inherited access, and exact `juyu.is_super_admin()`.
- Consumes: existing verified `Viewer`, request context and navigation-role arrays.

- [ ] **Step 1: Write failing role and navigation tests**

Add assertions equivalent to:

```ts
const superAdmin:Viewer={id:'super-1',role:'super_admin',companyVerified:true};
assert.equal(parseRole('super_admin'),'super_admin');
assert.equal(canManage(superAdmin),true);
assert.equal(isSuperAdmin(superAdmin),true);
assert.ok(navigationAllowed({roles:['admin']},'super_admin'));
assert.equal(readPublished(superAdmin,adminAudienceDocument)?.id,1);
```

Add a database matrix case that binds a `super_admin` request context and expects the same existing management reads as `admin`, plus `SELECT juyu.is_super_admin()` returning true only for the new role.

- [ ] **Step 2: Run the focused tests and verify the new role is rejected**

Run:

```bash
source "$HOME/.nvm/nvm.sh" && nvm use 24.19.0 >/dev/null
node --experimental-strip-types --test tests/access.test.ts tests/navigation-settings-client.test.ts
```

Expected: FAIL because `super_admin` is not a `Role` and exact role arrays reject it.

- [ ] **Step 3: Implement TypeScript role inheritance**

Use explicit helpers instead of scattered equality checks:

```ts
export type Role='support'|'ops'|'admin'|'super_admin';
export const isAdministratorRole=(role:Role|null):boolean=>role==='admin'||role==='super_admin';
export const isSuperAdmin=(viewer:Viewer|null):boolean=>isVerified(viewer)&&viewer.role==='super_admin';
export function canManage(viewer:Viewer|null):boolean{return isVerified(viewer)&&isAdministratorRole(viewer.role);}
```

Treat `super_admin` as `admin` when evaluating reader audiences, admin-page authentication and stored navigation roles. Keep navigation audiences as the existing Support/Ops/Admin choices: selecting Admin also includes Super Admin, rather than exposing a misleading Super Admin-only reader audience. Add the Chinese label `超级管理员` and English label `Super Admin` in account controls.

- [ ] **Step 4: Add migration 0043 for the role constraints and SQL helpers**

The migration must replace every role check constraint covering `members.observed_role`, member-operation roles, enrollment roles and request contexts so `super_admin` is valid. Replace `juyu.is_admin()` with inherited semantics and add:

```sql
CREATE FUNCTION juyu.is_super_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
 SELECT coalesce((SELECT role='super_admin' FROM juyu.current_identity()),false)
$$;
REVOKE ALL ON FUNCTION juyu.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.is_super_admin() TO juyu_runtime;
```

Update `juyu.review_admin_eligible`, audience checks, OPS checks, announcement target checks and current `can_read_document` definitions from exact `admin` comparisons to inherited administrator semantics while preserving Support and Ops behavior. Keep enrollment bootstrap roles as `admin`/`support`; first Super Admin assignment belongs only to Task 2's controlled promotion command.

- [ ] **Step 5: Run domain and real-database permission tests**

Run:

```bash
node --experimental-strip-types --test tests/access.test.ts tests/navigation-settings-client.test.ts
node --experimental-strip-types --test --test-concurrency=1 tests/database/permission-matrix.test.ts
```

Expected: PASS; Super Admin inherits Admin access and no lower role gains access.

- [ ] **Step 6: Commit the role foundation**

```bash
git add src/domain/model.ts src/domain/access.ts src/navigation-settings/model.ts src/components/navigation-settings/NavigationSettings.tsx src/components/shell/AccountControls.tsx src/server/authentication/admin.ts src/server/ops/repository.ts src/server/database/migrations/0043_super_admin_role.sql tests/access.test.ts tests/navigation-settings-client.test.ts tests/database/permission-matrix.test.ts
git commit -m "Add Super Admin role inheritance"
```

### Task 2: Secure Super Admin assignment and last-account protection

**Files:**
- Create: `scripts/promote-initial-super-admin.ts`
- Modify: `src/server/members/service.ts`
- Modify: `src/server/members/store.ts`
- Modify: `src/server/members/input.ts`
- Modify: `src/server/members/clerk.ts`
- Modify: `src/components/members-panel.tsx`
- Test: `tests/members.test.ts`
- Test: `tests/database/members.test.ts`
- Test: `tests/e2e/members-panel.spec.ts`

**Interfaces:**
- Consumes: Task 1 `Role`, `isSuperAdmin`, `juyu.is_super_admin()`.
- Produces: member role changes where only Super Admin may grant/remove `super_admin`, plus a `promote-initial-super-admin.ts` command that accepts one exact Clerk user ID for the first assignment.

- [ ] **Step 1: Write failing member-service tests**

Cover these exact cases:

```ts
await assert.rejects(adminService.change(target,{type:'role',expectedRole:'admin',role:'super_admin'}),/SUPER_ADMIN_REQUIRED/);
await assert.rejects(superService.change(lastSuper,{type:'role',expectedRole:'super_admin',role:'admin'}),/LAST_SUPER_ADMIN/);
assert.equal((await superService.change(secondSuper,{type:'role',expectedRole:'super_admin',role:'admin'})).status,'applied');
```

Also assert that disabling the final active Super Admin fails and that existing self-change protection still wins for the acting account.

- [ ] **Step 2: Run the member tests and verify escalation is currently accepted or untyped**

Run:

```bash
node --experimental-strip-types --test tests/members.test.ts
node --experimental-strip-types --test --test-concurrency=1 tests/database/members.test.ts
```

Expected: FAIL because the service has no exact Super Admin gate or last-account count.

- [ ] **Step 3: Implement role-change authorization inside the existing member lock**

After fresh provider and database identity checks, apply:

```ts
const touchesSuper=before==='super_admin'||change.type==='role'&&change.role==='super_admin';
if(touchesSuper&&actor.role!=='super_admin')throw new Error('SUPER_ADMIN_REQUIRED');
if((before==='super_admin'&&(change.type==='disable'&&change.disabled||change.type==='role'&&change.role!=='super_admin'))
  && await this.store.activeSuperAdminCount(client)===1)throw new Error('LAST_SUPER_ADMIN');
```

Keep intent persistence, Clerk write, fresh readback and reconciliation unchanged. Add the role to the members dropdown only for Super Admin viewers; ordinary Admins see the role as a label but cannot select it.

- [ ] **Step 4: Implement controlled first promotion**

The script accepts one exact Clerk user ID, verifies that no active Super Admin exists, verifies the target is an active company-verified Admin, records a member operation, updates Clerk metadata, reads it back, and completes the observed database role. It must refuse emails and multiple arguments:

```ts
if(process.argv.length!==3||!/^user_[A-Za-z0-9]+$/.test(process.argv[2]))throw new Error('EXACT_CLERK_USER_ID_REQUIRED');
```

When `initialization.owner_id` exists, the script requires the supplied ID to match it. When it is absent, the explicit verified Admin ID is accepted once.

- [ ] **Step 5: Run service, database and members-panel tests**

Run:

```bash
node --experimental-strip-types --test tests/members.test.ts
node --experimental-strip-types --test --test-concurrency=1 tests/database/members.test.ts
npx playwright test tests/e2e/members-panel.spec.ts
```

Expected: PASS for Admin/Super Admin visibility, last-account protection and audit reconciliation.

- [ ] **Step 6: Commit assignment protection**

```bash
git add scripts/promote-initial-super-admin.ts src/server/members src/components/members-panel.tsx tests/members.test.ts tests/database/members.test.ts tests/e2e/members-panel.spec.ts
git commit -m "Protect Super Admin assignments"
```

### Task 3: Direct-publication domain state and database integrity

**Files:**
- Create: `src/server/database/migrations/0044_super_admin_direct_publish.sql`
- Modify: `src/domain/model.ts`
- Modify: `src/domain/workflow.ts`
- Modify: `src/server/database/repository.ts`
- Test: `tests/workflow.test.ts`
- Test: `tests/database/authorization.test.ts`
- Test: `tests/database/history.test.ts`
- Test: `tests/database/localization.test.ts`
- Test: `tests/database/submission.test.ts`
- Test: `tests/database/analytics.test.ts`
- Test: `tests/database/announcements.test.ts`
- Test: `tests/database/categories.test.ts`
- Test: `tests/database/favorites.test.ts`
- Test: `tests/database/feature-flags.test.ts`
- Test: `tests/database/forms.test.ts`
- Test: `tests/database/navigation-settings.test.ts`
- Test: `tests/database/qa.test.ts`
- Test: `tests/database/recent.test.ts`
- Test: `tests/database/search.test.ts`
- Test: `tests/database/setting-history.test.ts`
- Test: `tests/database/supporting.test.ts`

**Interfaces:**
- Consumes: Task 1 `isSuperAdmin(actor)` and SQL `juyu.is_super_admin()`.
- Produces: `Command {type:'direct_publish';englishQualityConfirmed?:boolean}`, `Workflow.approvalMode:'standard'|'super_admin'`, and immutable `AuditEntry.action='direct_publish'`.

- [ ] **Step 1: Write failing domain tests for truthful direct publication**

Add tests equivalent to:

```ts
const result=transition(draft,{type:'direct_publish'},superAdmin,{expectedSequence:0,now});
assert.equal(result.workflow.status,'published');
assert.equal(result.workflow.approvalMode,'super_admin');
assert.equal(result.workflow.submittedBy,superAdmin.id);
assert.equal(result.workflow.reviewerId,superAdmin.id);
assert.equal(result.workflow.approvedBy,superAdmin.id);
assert.equal(result.audit.at(-1)?.action,'direct_publish');
assert.equal(result.audit.at(-1)?.reason,null);
assert.throws(()=>transition(draft,{type:'direct_publish'},adminA,{expectedSequence:0,now}),/FORBIDDEN/);
```

Retain the existing test that ordinary self-review throws `INVALID_REVIEWER`.

- [ ] **Step 2: Run the workflow tests and verify the command is unsupported**

Run:

```bash
node --experimental-strip-types --test tests/workflow.test.ts
```

Expected: FAIL because `direct_publish` and approval mode do not exist.

- [ ] **Step 3: Implement the domain transition**

Add a `direct_publish` switch branch limited to `draft` and `changes_requested`, requiring `isSuperAdmin(actor)`, setting the actor in all three truthful identity fields, selecting `super_admin` mode, setting the published revision and appending one event. Fresh and edited workflows default to `standard`.

- [ ] **Step 4: Add migration 0044 and repository persistence**

Add `approval_mode text NOT NULL DEFAULT 'standard'` to documents and replace workflow constraints so only `super_admin` mode may use the same identity for submitter, reviewer and approver. Extend audit action constraints and integrity triggers. The trigger must require:

```sql
IF d.approval_mode='super_admin' AND NOT EXISTS (
 SELECT 1 FROM juyu.audit_log a JOIN juyu.members m ON m.clerk_user_id=a.actor_id
 WHERE a.document_id=d.id AND a.revision_id=d.workflow_revision_id
   AND a.action='direct_publish' AND a.actor_id=d.submitted_by
   AND a.actor_id=d.reviewer_id AND a.actor_id=d.approved_by
   AND m.observed_role='super_admin'
) THEN RAISE EXCEPTION 'INTEGRITY: missing super admin publication evidence'; END IF;
```

Persist and reload `approval_mode`; `persistDocumentTransition` inserts no `reviews` row for `direct_publish` because the audit action itself is the truthful approval evidence.

Replace every current reader-side publication lookup that accepts only `action='publish'` so it accepts `publish` and `direct_publish`: `juyu.publication_number`, `juyu.read_publication_timestamp`, `juyu.read_changelog`, `juyu.read_changelog_locale`, the publication-feed partial index and the deferred document-integrity trigger. This preserves publication numbers, published timestamps, release notes and changelog visibility for directly published content without adding a fake second `publish` event.

Update every migration-upgrade assertion that currently ends at `0042_draft_actions` so it expects `0043_super_admin_role` and `0044_super_admin_direct_publish` in order. Preserve each test's existing before/after data checks; the new migrations must not rewrite prior publication or review history.

- [ ] **Step 5: Run domain and database integrity tests**

Run:

```bash
node --experimental-strip-types --test tests/workflow.test.ts
npm run test:db
```

Expected: PASS; forged self-approval rows fail database constraints while the verified direct command succeeds. The directly published revision must appear as publication number 1 with its timestamp and release note in both Chinese and English changelog paths.

- [ ] **Step 6: Commit direct-publication state**

```bash
git add src/domain/model.ts src/domain/workflow.ts src/server/database/repository.ts src/server/database/migrations/0044_super_admin_direct_publish.sql tests/workflow.test.ts tests/database/authorization.test.ts tests/database/history.test.ts tests/database/localization.test.ts tests/database/submission.test.ts tests/database/analytics.test.ts tests/database/announcements.test.ts tests/database/categories.test.ts tests/database/favorites.test.ts tests/database/feature-flags.test.ts tests/database/forms.test.ts tests/database/navigation-settings.test.ts tests/database/qa.test.ts tests/database/recent.test.ts tests/database/search.test.ts tests/database/setting-history.test.ts tests/database/supporting.test.ts
git commit -m "Add atomic Super Admin publication state"
```

### Task 4: Publication API, fresh authorization and exact retries

**Files:**
- Modify: `src/review/publication.ts`
- Modify: `src/review/publication-client.ts`
- Modify: `src/server/review/publication.ts`
- Modify: `src/server/authorization/service.ts`
- Modify: `src/app/api/admin/review/[id]/publication/route.ts`
- Create: `tests/publication-model.test.ts`
- Test: `tests/publication-client.test.ts`
- Test: `tests/database/publication.test.ts`
- Test: `tests/review-http.test.ts`

**Interfaces:**
- Consumes: Task 3 `direct_publish`, approval mode and audit action.
- Produces: `PublicationInput.action:'queue'|'publish'|'direct_publish'`, `PublicationDetail.canDirectPublish`, and `PublicationAck.action:'direct_publish'`.

- [ ] **Step 1: Write failing input, authorization and retry tests**

Test exact input only:

```ts
assert.deepEqual(publicationInput({expectedSequence:4,action:'direct_publish',englishQualityConfirmed:true}),{expectedSequence:4,action:'direct_publish',englishQualityConfirmed:true});
assert.throws(()=>publicationInput({expectedSequence:4,action:'direct_publish',reason:'x'}));
```

Add service/database tests for Admin denial, fresh Super Admin success, downgrade during the document-lock wait, English confirmation denial, stale sequence, pending uploads and retry idempotency.

- [ ] **Step 2: Run focused publication tests and verify failure**

Run:

```bash
node --experimental-strip-types --test tests/publication-model.test.ts tests/publication-client.test.ts tests/review-http.test.ts
node --experimental-strip-types --test --test-concurrency=1 tests/database/publication.test.ts
```

Expected: FAIL because the parser and service accept only `queue` and `publish`.

- [ ] **Step 3: Extend the existing publication endpoint**

Return `canDirectPublish` only when the freshly loaded actor is Super Admin and the document is `draft` or `changes_requested`. In `changeSavedPublication`, re-check `juyu.is_super_admin()` before and after acquiring locks, run `requireReadyAssets`, validate English confirmation, call the Task 3 transition, and persist it atomically.

- [ ] **Step 4: Implement exact acknowledgement validation**

The client must require matching document, sequence, revision, action, status and published revision. Treat an ambiguous response as the existing uncertain-save state and resend the exact original input; never rebuild it from newer UI state.

- [ ] **Step 5: Run focused API and database tests**

Run:

```bash
node --experimental-strip-types --test tests/publication-model.test.ts tests/publication-client.test.ts tests/review-http.test.ts
node --experimental-strip-types --test --test-concurrency=1 tests/database/publication.test.ts
```

Expected: PASS, including no state change after a mid-flight downgrade and a single audit event after a retry.

- [ ] **Step 6: Commit the direct-publication API**

```bash
git add src/review/publication.ts src/review/publication-client.ts src/server/review/publication.ts src/server/authorization/service.ts 'src/app/api/admin/review/[id]/publication/route.ts' tests/publication-model.test.ts tests/publication-client.test.ts tests/database/publication.test.ts tests/review-http.test.ts
git commit -m "Expose Super Admin direct publishing"
```

### Task 5: Super Admin confirmation interface in editor and publication workbench

**Files:**
- Modify: `src/editor/contract.ts`
- Modify: `src/server/database/repository.ts`
- Modify: `src/components/editor/ArticleEditor.tsx`
- Create: `src/components/review/DirectPublishConfirmation.tsx`
- Modify: `src/components/review/PublicationPanel.tsx`
- Modify: `src/app/review-layout.css`
- Test: `tests/e2e/editor.spec.ts`
- Test: `tests/e2e/permission-audit.spec.ts`
- Test: `tests/e2e/publication.spec.ts`

**Interfaces:**
- Consumes: Task 4 `canDirectPublish` and `changePublication(...,{action:'direct_publish'})`.
- Produces: Super Admin-only `批准并发布` button and confirmation with no reason control.

- [ ] **Step 1: Write failing browser tests for visibility and confirmation**

Mount Support, Ops, Admin and Super Admin fixtures. Assert only Super Admin sees `批准并发布`. After clicking, assert the dialog contains `确认发布` and no textbox or textarea. Confirm and assert exactly one request:

```ts
expect(write).toEqual({expectedSequence:3,action:'direct_publish',englishQualityConfirmed:false});
```

For English, require the existing natural-English checkbox before enabling confirmation.

- [ ] **Step 2: Run the focused browser tests and verify the button is absent**

Run:

```bash
npx playwright test tests/e2e/editor.spec.ts tests/e2e/permission-audit.spec.ts tests/e2e/publication.spec.ts --grep "Super Admin|direct publish"
```

Expected: FAIL because no direct action exists.

- [ ] **Step 3: Implement the editor shortcut**

Add server-derived `canDirectPublish` to `EditorData`. Extract one controlled `DirectPublishConfirmation` component and use it in both the editor and publication workbench so the wording, absence of a reason field and confirmation behavior cannot drift. Neither component independently decides role access. Disable the editor action while there are unsaved changes, a pending upload or a save uncertainty.

- [ ] **Step 4: Implement the publication-workbench action**

Render the action only from `detail.canDirectPublish`. Use copy:

```text
批准并发布
这份当前保存的内容将由你的 Super Admin 账号直接批准并发布。
取消 / 确认发布
```

Do not add a reason input. Preserve distinct existing conflict, permission, upload, English-quality and service-error messages.

- [ ] **Step 5: Run desktop and mobile browser tests**

Run:

```bash
npx playwright test tests/e2e/editor.spec.ts tests/e2e/permission-audit.spec.ts tests/e2e/publication.spec.ts
```

Expected: PASS on desktop and mobile projects.

- [ ] **Step 6: Commit the interface**

```bash
git add src/editor/contract.ts src/server/database/repository.ts src/components/editor/ArticleEditor.tsx src/components/review/DirectPublishConfirmation.tsx src/components/review/PublicationPanel.tsx src/app/review-layout.css tests/e2e/editor.spec.ts tests/e2e/permission-audit.spec.ts tests/e2e/publication.spec.ts
git commit -m "Add Super Admin publish confirmation"
```

### Task 6: Truthful history, review projections and operational labels

**Files:**
- Modify: `src/server/review/publication.ts`
- Modify: `src/review/publication.ts`
- Modify: `src/components/review/PublicationPanel.tsx`
- Modify: `src/server/history/repository.ts`
- Modify: `src/components/history/HistoryTimeline.tsx`
- Modify: `src/workspace/model.ts`
- Test: `tests/history-client.test.ts`
- Test: `tests/publication-model.test.ts`
- Test: `tests/e2e/history.spec.ts`

**Interfaces:**
- Consumes: Task 3 `direct_publish` audit event.
- Produces: history labels `Super Admin 直接发布` and `Published directly by Super Admin` with actor and timestamp.

- [ ] **Step 1: Write failing projection and UI tests**

Provide one direct event and assert history returns it without a reviewer name, reason or invented submit/approve rows. Browser text must contain the actor and `Super Admin 直接发布`.

- [ ] **Step 2: Run the history tests and verify the new action is rejected or unlabeled**

Run:

```bash
node --experimental-strip-types --test tests/history-client.test.ts tests/publication-model.test.ts
npx playwright test tests/e2e/history.spec.ts --grep "Super Admin"
```

Expected: FAIL because action unions and labels do not include `direct_publish`.

- [ ] **Step 3: Extend history projections and labels**

Include `direct_publish` in bounded publication history queries and client unions. Render the actor and timestamp once. Do not display a review reason or a second reviewer.

- [ ] **Step 4: Run focused history tests**

Run:

```bash
node --experimental-strip-types --test tests/history-client.test.ts tests/publication-model.test.ts
npx playwright test tests/e2e/history.spec.ts --grep "Super Admin"
```

Expected: PASS.

- [ ] **Step 5: Commit truthful history**

```bash
git add src/server/review/publication.ts src/review/publication.ts src/components/review/PublicationPanel.tsx src/server/history/repository.ts src/components/history/HistoryTimeline.tsx src/workspace/model.ts tests/history-client.test.ts tests/publication-model.test.ts tests/e2e/history.spec.ts
git commit -m "Show truthful Super Admin publication history"
```

### Task 7: Full migration, permission and production-build acceptance

**Files:**
- Test: all `tests/*.test.ts`
- Test: `tests/database/*.test.ts`
- Test: `tests/e2e/foundation.spec.ts`
- Test: `tests/e2e/editor.spec.ts`
- Test: `tests/e2e/favorites.spec.ts`
- Test: `tests/e2e/favorites-reader.spec.ts`
- Test: `tests/e2e/ops.spec.ts`
- Test: `tests/e2e/reference.spec.ts`
- Test: `tests/e2e/qa.spec.ts`
- Test: `tests/e2e/qa-reuse.spec.ts`
- Test: `tests/e2e/pending-ui.spec.ts`
- Test: `tests/e2e/members-panel.spec.ts`
- Test: `tests/e2e/permission-audit.spec.ts`
- Test: `tests/e2e/publication.spec.ts`
- Test: `tests/e2e/history.spec.ts`

**Interfaces:**
- Consumes: all previous tasks.
- Produces: a release-ready main-branch change plus the exact first-promotion command for rollout.

- [ ] **Step 1: Run all unit tests**

```bash
source "$HOME/.nvm/nvm.sh" && nvm use 24.19.0 >/dev/null
npm test
```

Expected: all tests pass with zero skipped Super Admin cases.

- [ ] **Step 2: Run the complete real-database suite**

```bash
npm run test:db
```

Expected: all migrations apply from an empty database and every database test passes.

- [ ] **Step 3: Run type checking and lint**

```bash
npm run typecheck
npm run lint
```

Expected: both exit 0.

- [ ] **Step 4: Run critical browser acceptance**

```bash
npm run test:critical
npx playwright test tests/e2e/members-panel.spec.ts tests/e2e/permission-audit.spec.ts tests/e2e/publication.spec.ts tests/e2e/history.spec.ts
```

Expected: desktop and mobile critical tests pass, and the additional administrative suites pass for ordinary Admin review, Super Admin direct publication, member-role protection and truthful history.

- [ ] **Step 5: Run the production build**

```bash
npm run build
```

Expected: Next.js production build and postbuild asset checks exit 0.

- [ ] **Step 6: Review the final diff for permission gaps**

```bash
rg -n "role.?===.?['\"]admin|role.?!==.?['\"]admin|IN \('ops','admin'\)|role='admin'|support.*ops.*admin" src tests
git diff --check
```

Classify every remaining exact Admin comparison as intentionally Admin-only, inherited administrator access, or a missing Super Admin update. If a missing case appears, return to the task that owns that file, add the regression test described there, make the correction, rerun that task's focused test commands, then restart Task 7 from Step 1.

- [ ] **Step 7: Produce rollout instructions without executing production mutation**

Report the exact commit and migration numbers `0043` and `0044`. Verify that the promotion command refuses to run without the separately confirmed Clerk user ID:

```bash
source "$HOME/.nvm/nvm.sh" && nvm use 24.19.0 >/dev/null
node --experimental-strip-types scripts/promote-initial-super-admin.ts
```

Expected: exits non-zero with `EXACT_CLERK_USER_ID_REQUIRED` and makes no external change. Do not run the production promotion until the user supplies or confirms the exact Clerk user ID. Pushing the verified code to GitHub is allowed only when the user requests it for this implementation.
