# T035 Review decision execution record

Scope approved in TASKS/user continuation: assigned independent Admin approves or returns saved submitted revision. Return reason is required; editing creates a new draft which can be submitted again. Approval alone does not publish. Existing publication remains readable.

- [x] Backend: current assigned reviewer and eligibility checks; bounded reason, CAS and exact decision retry; immutable review/audit metadata, preserved publication; real restricted database concurrency/rollback tests.
- [x] UI: read-only review page with exact current article and labeled review metadata, approve confirmation, reject reason, explicit status and unknown-result retry; editor link and revised resubmit prerequisite.
- [x] HTTP: current Admin before parsing; same-origin bounded POST; private no-store; safe errors and inaccessible real unconfigured routes.
- [x] Verification: tests, independent review, build/types/lint, screenshots, source/Task records, restored preview.

Decision: changes_requested cannot be resubmitted unchanged through production submission service; edit/save must produce a new draft first, matching the user's '内容修改后重新提交'. Previous T034 local test allowing unchanged submission is updated. Generic internal domain transition remains available for existing history fixtures; public service is authoritative.

Use subagent-driven implementation with separate backend/UI ownership and independent final review. Existing workspace has no Git repo; no worktree operations/upstream edits. All test data is local and isolated. Clerk/Supabase/company/true device/deployment acceptance remains pending.

Outcome: 186 unit/rule checks, 142 restricted database checks, 248 desktop/mobile browser checks, build/type/lint passed. Independent review clean. Verified legacy media and complete review metadata, read-only content, unknown-outcome action lock and actual closed endpoints. Source records and TASKS updated; preview restored. External integration still pending.
