# Super Admin direct publication design

## Goal

Add a `super_admin` role above the existing `admin` role. A Super Admin may edit a draft and publish that same revision without another administrator reviewing it. The action does not ask for or store a special-approval reason.

Ordinary Admin behavior does not change: Admins still need an independent eligible Admin or Super Admin to approve their revision before publication.

## Scope

This change adds one role and one explicit publication path. It does not remove any existing Admin permissions. A Super Admin inherits every existing Admin capability and additionally receives the direct-publication capability.

The direct path applies to articles, Q&A, OPS Internal and Reference content. It applies to Chinese and English revisions. Existing validation, media readiness, audience checks, English-quality confirmation and optimistic version checks remain mandatory.

## Roles and access inheritance

`Role` becomes `support | ops | admin | super_admin`.

- `super_admin` is treated as Admin for every existing management permission and for `admin` and `ops` reader audiences.
- A separate `is_super_admin` check protects the direct-publication endpoint and Super Admin role management.
- Existing navigation entries that allow `admin` also allow `super_admin`; stored navigation does not need to be manually rewritten to keep the management interface reachable.
- Account controls display `超级管理员` or `Super Admin` instead of the Admin label.

## Direct-publication workflow

The editor and publication workbench show a Super Admin-only action named `批准并发布` / `Approve and publish` when the current saved revision is in `draft` or `changes_requested` state.

Selecting the action opens a short confirmation dialog. It does not contain a reason field. Confirming sends one `direct_publish` command containing the current expected sequence and, for an English revision, the existing English-quality confirmation.

The server performs the following in one database transaction while holding the existing member and document locks:

1. Re-read the signed-in identity and require the current role to be `super_admin`.
2. Re-read and lock the document; reject a stale sequence or a revision that changed after the confirmation opened.
3. Run all existing content, category, custom-field, language, attachment and media-readiness checks.
4. Record the actor as submitter, approver and publisher for the same current revision using an explicit `super_admin` approval mode.
5. Set the workflow and published revision to `published`.
6. Append one immutable `direct_publish` audit event.

The system does not fabricate an independent reviewer. Reader and history screens describe the event as `Super Admin 直接发布` / `Published directly by Super Admin` and show the real actor and time.

Retry behavior follows the existing exact-acknowledgement pattern. Retrying an already committed command returns the existing result without publishing twice, changing the publication time or adding another audit event.

## Standard review compatibility

A Super Admin may still use the normal two-person review flow. In that flow, the existing independence rules remain in force: the reviewer cannot be the author, editor or submitter of that revision.

A Super Admin can serve as the independent reviewer for another person. The `direct_publish` path is the only path that allows one identity to be editor, approver and publisher.

If a revision is already `in_review`, the direct-publication action is unavailable. The current review must first be withdrawn through the existing control flow so the immutable review history remains truthful.

## Database representation

A new migration performs all role and workflow changes together:

- Extend member, member-operation and enrollment role constraints to accept `super_admin`.
- Extend identity and audience functions so Super Admin inherits Admin access.
- Add `juyu.is_super_admin()` for exact privileged checks.
- Add an approval mode to the document workflow with allowed values `standard` and `super_admin`.
- Preserve the current independent-review constraints for `standard` mode.
- Permit identical submitter, reviewer and approver only when the mode is `super_admin` and the immutable audit event is `direct_publish` by that same verified Super Admin.
- Extend the immutable audit action constraint with `direct_publish`.
- Extend database integrity triggers so a published direct revision must have matching actor, role, revision and audit evidence.

No existing published document is rewritten. Existing rows remain `standard` and keep their current review evidence.

## Super Admin assignment

Existing Admin accounts are not automatically upgraded as a group.

For rollout, the existing initialization owner is promoted only if it is still an active, verified Admin. If the installation has no recorded initialization owner, rollout requires one explicit existing Clerk user ID; the promotion tool refuses email addresses, unknown users, disabled users and non-Admin accounts.

After the first Super Admin exists:

- Ordinary Admins may continue managing `support`, `ops` and `admin` roles under the current rules.
- Only a Super Admin may grant or remove `super_admin`.
- A Super Admin cannot change or disable their own account through the members screen.
- The final active Super Admin cannot be downgraded or disabled.
- Every grant, downgrade and disable operation remains recorded in member-operation history.

## User interface

The regular Admin interface remains unchanged.

For a Super Admin:

- Account menus show the Super Admin role label.
- The publication workbench displays `批准并发布` alongside the ordinary review route.
- The confirmation explains that the same account will approve and publish the current saved revision.
- The dialog has only `取消` and `确认发布`; it has no reason field.
- Success returns to the published state and shows the new publication number and revision.
- Conflict, incomplete upload, invalid English confirmation, permission loss and unavailable service errors retain their existing distinct messages.

## Security and failure behavior

The browser never decides whether someone is a Super Admin. The server verifies the fresh session role and the database verifies the scoped identity again inside the transaction.

Direct publication does not bypass:

- company verification or account-disable checks;
- stale-version protection;
- content and private-asset validation;
- media quarantine and pending-upload checks;
- locale and English-quality requirements;
- immutable history;
- exact response acknowledgement.

If any check fails, no approval, audit event or publication state is committed.

## Testing and acceptance

Tests cover all four content kinds and both locales where applicable.

Required acceptance cases:

- Support, Ops and Admin cannot call or see direct publication.
- Super Admin can directly publish their own saved draft without a reason.
- The same actor is truthfully shown as editor, approver and publisher.
- The standard Admin review path still refuses self-review.
- A stale revision, pending upload, invalid attachment, permission downgrade or identity mismatch commits nothing.
- An exact retry does not duplicate audit history or publication timestamps.
- Super Admin receives Admin reader and navigation access.
- Ordinary Admin cannot grant `super_admin`.
- The final active Super Admin cannot be downgraded or disabled.
- Existing standard reviews and publications still satisfy their original integrity rules after migration.
- Type checking, lint, unit tests, permission-matrix database tests, desktop/mobile browser tests and production build all pass under Node 24.19.0.

## Rollout

1. Deploy the database migration and application together so neither side sees an unknown role or workflow mode.
2. Promote the one initial Super Admin through the controlled bootstrap path.
3. Sign out and sign back in so Clerk and the database observe the new role.
4. Verify an ordinary Admin still requires independent review.
5. Verify a Super Admin can directly publish a disposable test draft and that the published history identifies it as direct publication.
6. Keep rollback limited to disabling the direct action. Do not rewrite or delete direct-publication audit records.
