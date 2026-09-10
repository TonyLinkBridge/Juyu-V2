# T033 Trash and Recovery Implementation Plan

> For agentic workers: use superpowers:subagent-driven-development, task-by-task, with independent final review.

Goal: Admin-only trash, restore-to-unpublished-draft and explicitly confirmed permanent deletion, with audited version checks and honest private-file cleanup.
Architecture: Existing lifecycle/read guards immediately close employee access. A new migration provides bounded lifecycle transitions, immutable deletion receipts and private storage cleanup jobs; permanent deletion removes document data through a narrowly authorized database function, without general runtime DELETE privileges. UI uses current sequence and never simulates success.
Tech Stack: existing Next.js/React/TypeScript, PostgreSQL, private storage.
Spec: TASKS.md T033 and accepted role/publication contract.

Ruling: Restoring always yields an unpublished draft, clears current reviewer/approval/publication pointers, and does not expose old or unapproved content. Existing review/audit evidence retained until explicit purge; purge keeps a separate immutable audit receipt and metadata history, not article bodies.
Ruling: Permanent deletion requires trash state, current sequence and exact title confirmation. No real company data is deleted in this task; all destructive verification uses isolated fixtures.
Ruling: File deletion is not atomic with PostgreSQL. Persist a cleanup job before deleting content, close authorization immediately, then remove private blobs and verify absence. Any failed/unknown cleanup stays pending with an Admin retry action; never report complete while pending.

- [x] Database/backend: migration0009, lifecycle model/input, versioned trash/restore/purge, immutable receipts and cleanup job authorization, paginated trash list, tests on restricted roles and no bypass of immutable normal writes.
- [x] Storage: provider delete+absence verification, bounded retryable cleanup runner; no public object URLs; local/HTTP tests only.
- [x] UI/API: current document action in editor, trash page with restore/purge distinct controls and exact title confirmation, bounded authenticated same-origin API, failure/refresh/retry controls. Disable deleting during unsaved edits/uploads.
- [x] Verification: unit, real local database, desktop/mobile actual components + unconfigured endpoints, build/type/lint, source record, independent review and TASKS update. Real Clerk/Supabase, devices and deployment remain pending.

Existing standalone Juyu V2 workspace has no Git repository; do not create/delete worktrees, alter upstream folders or connect real services. All writes in renamed directory need sandbox escalation as before.

Outcome: local implementation accepted: 185 unit/storage, 114 database, 208 browser checks, build/type/lint. Independent review closed asset UUID interleaving and unstarted-job starvation findings. Actual-attempt persistence replaced batch claims; read-only listing never advances attempt times. See docs/verification/2026-09-09-trash-recovery.md. Cloud services/devices/deployment remain explicitly unaccepted.
