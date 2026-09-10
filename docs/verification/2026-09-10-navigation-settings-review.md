# T051 independent navigation-settings review

## Source review result

No actionable findings in the reviewed T051 source changes against the binding plan. No confirmed privacy, authorization, functional, data-loss or exact-retry issue was found.

Reviewed model/client, settings UI and recovery, Admin/employee endpoints, authorization service, migration 0023, category tree/landing, reader chrome/menu and every changed authenticated reader page, plus focused regression sources. Compared prior migration files byte-for-byte against the stage baseline: none changed.

## Boundary evidence

- Employee SQL projection returns only filtered `{id,label,href}`. Raw configuration reads remain eligible-Admin-only, including runtime table RLS. Menu visibility intersects current identity, configured role and enabled status, OPS eligibility, and current readable formal category memberships. Fixed target validation excludes arbitrary URLs/code.
- Absent configuration gives version-0 defaults; saved empty/all-hidden configuration stays saved and does not fall back. Whole-config CAS, latest same-actor/config retry, immutable versions, lock serialization and post-wait member eligibility checks are present.
- Category landing derives names and counts exclusively from authorized current publications and categories. The new repeatMemberships option is explicit; default ordinary article-tree behavior still deduplicates. Each landing deduplicates its own recursive result, with restricted/empty targets yielding generic unavailable content.
- Menu hiding does not modify destination ACLs. Existing body/search/file/PDF authorization paths remain independent. Reader menu integration uses server-filtered items and retains existing essential controls.
- Settings client validates the exact config envelope, next version and ordered payload. Unknown results retain the original submission; later rejection does not claim the first write failed. Reload applies only after both navigation and category responses validate. Cumulative backups, restoring against the last loaded version, and leave protection retain unsaved work.

## Final scoped follow-up

ReaderMenu now catches only asynchronous data/authentication failures and renders JSX afterward. The loaded item payload, failed/unavailable state and currentHref behavior are preserved. ReaderQuickLinks and CategoryLanding changes only replace lint suppression directives with explanatory comments. No new correctness or authorization regression was found. No outstanding actionable review findings.

## Verification limits / remaining root validation

This was a read-only source review: no tests, builds, browser runs, product edits, Git operations or external-service calls were performed by the reviewer. Implementer reports recorded 14 focused checks, 306 unit checks, build success and 18 settings browser checks; root subsequently reports full database 348/348.

The earlier compiled-CSS issue is resolved by the recorded cache-cleared rebuild, without CSS source changes. Read-only verification found 8 preserved old CSS files with zero reader-shortcuts/category-landing matches, while current compiled CSS includes both rules. Read browser-reader-recheck.log: all 8 desktop/mobile reader checks passed, including the formerly failing menu scenario. Also read db-full.log: 348/348 passed. These are inspection of existing artifacts/logs, not reviewer-executed tests.

The final ReaderMenu lint adjustment occurred afterward, so root still owns the final rebuild and whole-browser pass. The resolved focused browser failure must not be conflated with a completed final whole-browser run.

Real Clerk/Supabase/company-account configuration, cloud migration/deployment and physical-device acceptance remain unverified.

## Root final acceptance addendum

After the independent review, root completed final build, typecheck and lint without errors/warnings; whole browser548/548 and reader final8/8 passed. The final reader test-only adjustment waits for the dark-mode button background transition before screenshot; product code stayed unchanged. Current actual3211 browser redirects and no-store503 APIs verified. No unresolved source-review findings remain; real cloud/account/device acceptance still pending.
