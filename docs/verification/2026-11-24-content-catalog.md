# Content catalog release verification

## Authorized scope

Release the selected catalog direction for the shared content workspace. Preserve real content, formal publications, history, role gates and article links. No production draft or publication mutation is part of verification.

## Implementation

- Existing authorized workspace responses feed cards directly. Original list and board URLs remain accepted.
- Knowledge landing and regular OPS/Reference/Q&A sidebar entries default to cards. Assigned-review queue and existing explicit list return links keep their established destinations.
- Cards reuse the original TasksList selection, version checks, batch confirmation, draft actions, review/publish destinations and refresh callbacks. No mock mutation handler is shipped.
- Search/type/status/scope, status totals, current-page batch selection, pagination, Q&A category/order/publication notice and expanded category paths remain available.
- Existing UI Arc FilterMenu/FilterToolbar provide add/remove/clear conditions. No new dependency, database query, category-filter API or schema change is introduced.
- Six decorative local WebP covers total under 50KB. Saved article/category metadata is rendered separately; no fabricated summary or preview data is published.

## Checks

- `npm run verify:build`: typecheck, lint, 625 unit tests and build passed. Lint retains one pre-existing anonymous test-loader export warning, no errors.
- Final typecheck and lint passed after integration adjustments.
- Focused desktop/mobile workspace, cards, categories, bulk withdrawal and own-withdrawal checks: 60 passed.
- Temporary PostgreSQL category/workspace tests: 3 passed, including cards/list equivalence and ordinary Admin batch denial.
- Temporary PostgreSQL authorization/workflow tests: 60 passed. Test fixture accepts no external connection URL, uses random local port and credentials, and ran with an empty inherited environment.
- Full critical run: 639 passed, 1 pre-existing conditional skip, and the 2 obsolete editor-status assertions failed. Those assertions were then corrected; fresh desktop/mobile editor-status and sidebar-navigation rerun: 4 passed. Previous `5933143` Verify failure was independently confirmed to use the obsolete `.editor-save-status` location; assertion now checks the actual visible status region. No editor runtime change.
- Reader-frame fixture now includes the existing onboarding modules needed to compile its actual account shell; this affects test support only.
- In-app browser: actual workspace source with fixtures; filters and removable chips, list/card switching, bulk confirm/cancel, original action links, phone type selector, 390px page overflow check, and no browser warning/error logs. Visual comparison/captures are listed in root `design-qa.md`.
- Independent code review checked role gates, action URLs and metadata. Addressed ordinary sidebar defaults and phone board control mismatch. Explicit old list return links intentionally remain compatible.

## Production baseline and rollback

- Base main revision, verified remotely: `593314306e7abe04c0b8263a4a21de81e2e69ab7`.
- Read-only production baseline: Knowledge total 51, draft 4, published 47, all other states 0; first page 30 items.
- Test-only compatibility repair: `e78d8909184ae1cbc4d173ed3cb8934b47c4b663`. This is the UI rollback checkpoint and should be retained.
- Rollback: revert only the subsequent UI release commit on main and allow the standard Vercel deployment. Do not reset the production database, drafts, publication records or Git history. Subsequent content changes are retained because this release contains no data migration or production data writes.
- Unrelated local AGENTS.md and account-clerk.ts edits are excluded and preserved.

## Limits

Production mutations are deliberately not exercised. Temporary fixture checks do not substitute for post-deployment read-only UI confirmation. GitHub Verify and Vercel deployment status are checked for the released SHA separately.
