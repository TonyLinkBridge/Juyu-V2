# T036 Review withdrawal and reassignment execution record

Accepted scope: any currently eligible Admin can manage an active pending review, including when its reviewer is no longer eligible. Withdrawal returns an unpublished draft; reassignment keeps the same submitted revision and original submitter. Existing employee publication is unchanged.

- [x] Backend: bounded current state/candidates/history; current actor/target checks; CAS and exact retry; same-review receipt validation; immutable old/new/revision/actor audit; real restricted DB races/rollback.
- [x] UI: dedicated management page linked from review page; explicit withdraw/reassign confirmation, old-reviewer unavailable state, pagination and bounded history labels, unknown-result recovery; no stale action after confirmed write or failed reload.
- [x] HTTP/page: existing Admin gates, private no-store GET/POST, bounded JSON/origin/query checks; no fake data or authorization bypass.
- [x] Verification: unit/database/browser/build/type/lint, independent review, desktop/mobile screenshots, source and TASKS records; local preview restored.

Choices: only in_review permits these actions. New reviewer excludes current operator, original submitter, revision author/editor and old reviewer. This keeps independent review and disallows no-op reassignment. History display shows latest20 control entries with explicit more indicator; full history UI remains T039. Separate management page avoids coupling pending approve/reject input with control input; server CAS protects open stale tabs.

Implementation via subagent-driven development with separate backend/UI ownership and independent review. No Git repository/worktree operations, upstream edits or real service writes. All fixtures local. Real Clerk/Supabase/company/device/deployment acceptance stays pending.
