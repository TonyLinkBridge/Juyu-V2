# Reader navigation optimization — 2026-10-15

## Scope

Improve switching between existing published articles without changing slug generation, stored URLs, canonical redirects, company membership verification, SQL role isolation, publication visibility, audience filtering, or feature checks. The additive `0057_reader_navigation` migration installs a restricted read-only projection. Existing article data, URLs and authorization functions are unchanged. Install the migration before deploying the new reader query.

## Changes

- The formal article read returns its menu, feature flags and knowledge entry from the same authorized repeatable-read transaction. The component no longer starts a second directory transaction through `readReaderPresentation`.
- Reuse the already-loaded feature flags when filtering the menu. Merge independent publication metadata reads into one SQL round trip, retaining all existing authorized publication functions.
- Directory queries omit the body when an explicit description exists. Articles without a description keep their existing first-paragraph fallback. The selected article still receives its full body.
- Use Fumadocs' official `RootProvider.components.Link` slot to reuse the existing Next.js `useLinkStatus` feedback. The pending indicator does not move the layout. Native link URLs and browser behavior are retained. Sidebar prefetch remains disabled; the change does not eagerly request every article.
- No cross-request or cross-viewer content cache was added.

## Follow-up from production timing

The first deployment (`b42502d`) fixed duplicate reads and pending feedback, but real Vercel logs still showed 3,179–3,646 ms in `database.work`. Supabase statistics identified the directory revision query (about 2 seconds) and category membership query (about 1 second) as the dominant work. JIT statistics were zero; changing JIT was therefore ruled out.

`read_publication_navigation(locale)` joins the current published revision first and applies the original `can_read_document` guard, which includes article audience, lifecycle, all category ancestors and translation-source visibility. It returns the original slug, title, summary, body fallback, icon and position. Category IDs come from the same authoritative `revision_categories` relation at the published revision, avoiding the second broad history scan. Public execution is revoked; only the existing runtime role can call it. Raw document policies and permissions are unchanged.

The explicit operator script verifies the exact production project and migration boundary, runs the versioned migration in a transaction, then verifies the function exists and is not executable by PUBLIC.

## Local evidence

- Before the fix: the component regression detected the second directory read. Real isolated PostgreSQL tests detected absent same-snapshot chrome and unnecessary full bodies for documents with explicit descriptions.
- `npm run verify:build`: 587 unit tests, typecheck, lint (one pre-existing fixture-loader warning), production build and postbuild checks passed.
- Database authorization, locales, navigation settings, developer contracts and legacy slugs: 99 tests passed. The formal article fixture uses one authorized scope, one feature-flags read, one directory read and at most 18 business queries, including all feedback/favorite permission checks.
- Related Fumadocs/loading browser suite: 83 passed initially. The stale PDF account-menu selector and new test's changing accessible-link name were corrected; the four affected desktop/mobile cases passed on rerun. This covers all 86 distinct relevant cases.
- The delayed-response browser test holds the destination request open, verifies immediate pending feedback on the actual clicked link, keeps the current page and directory controls usable, checks reduced motion/no horizontal overflow, then verifies feedback clears and an unauthenticated destination stays protected.
- A 40-revision history fixture checks that the actual projection plan emits only readable current publications, and a direct runtime-role check confirms drafts, restricted OPS, private articles and raw document access remain unavailable.
- New navigation feedback and database query-budget regressions run in Verify. Preview UI tests use an isolated development server because production correctly blocks design previews.

## Release acceptance

Local tests are not a claim about production latency. After pushing, verify the exact deployed release and repeat the signed-in sidebar transition, reload and original legacy URLs on the formal domain. Record live observations in the task. No exact speed-up percentage is claimed without comparable production timing samples.
