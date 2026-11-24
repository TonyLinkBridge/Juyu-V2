# Compatible dependency patches implementation plan

> **For agentic workers:** Use superpowers:executing-plans. Remain local; publication is explicitly paused.

**Goal:** Remove the currently identified high/critical dependency advisories using compatible releases, preserving the completed UI fixes and all application behavior.

**Architecture:** Update dependency manifests and lockfile only. Keep the BlockNote family at 0.54.2; its broader upgrade needs a separate user decision. Do not force an incompatible KaTeX override into its consumers.

**Tech Stack:** Node 24.19.0, npm, Next.js 16, React 19, Playwright.

**Spec:** User selected pause publication and dependency remediation; after the bounded patch-first recommendation, user replied “ok”. No production or release changes are authorized in this phase.

## Global constraints

- Work only in the existing isolated worktree. Preserve main's unrelated dirty AGENTS.md/account-clerk.ts.
- No push, merge, deployment, live-data mutation, exploit probes or production credentials.
- Review package origin/scripts before installation. Suppress dependency installation scripts.
- No npm audit fix --force, blanket latest upgrades, editor schema/content/permission/URL changes.

## Review focus

- Keep next/eslint-config-next versions aligned; installed peer requirements support existing React/Node.
- Native sharp platform artifacts must remain usable with install scripts disabled.
- Database-pool lifecycle helper export must remain compatible.
- Mermaid sanitizer changes must preserve existing diagram/math rendering and validation.
- Report unresolved low-severity nested KaTeX paths; do not misrepresent clean high/critical results as full security assurance.

## Task 1: Compatible manifest and lockfile repair

**Files:** package.json, package-lock.json, tests/database-pool-lifecycle.test.ts and tests/e2e/science.spec.ts (fixture compatibility/preparation only).

- [x] Read-only baseline npm audit --omit=dev: 12 dependency entries (5 low, 6 high, 1 critical), exit 1. This is the failing dependency gate; no synthetic version-only tests are added.
- [x] Inspect official advisory preconditions and package registry origin/scripts. Next.js 16.4.6 supports existing Node and React; @vercel/functions 3.11.3 retains Node >=20. No install scripts will run.
- [x] Pin next/eslint-config-next 16.4.6 and @vercel/functions 3.11.3.
- [x] Refresh compatible sharp, source-map-js, dompurify and zod lockfile resolutions; inspect complete package diff. Compatible development-tool remediation is recorded below.
- [x] Fresh production and complete-development audits: 4 low, zero moderate/high/critical; remaining entries listed below.
- [x] Install the reviewed lockfile with --ignore-scripts; run typecheck, lint, full units, optimized build/postbuild sequentially with empty production credentials. 627/627 unit tests passed, one pre-existing lint warning, build and postbuild passed.
- [x] Run editor, reader/science, catalog and workflow browser regressions using isolated fixtures; no build concurrently with tests. Critical suite: 657 passed, one intentional mobile board-layout skip; science suite after its standalone-fixture repair: 10/10 passed (see ledger).
- [x] Independent final review of manifest/lock diff, pool/science fixture corrections and limitations: no blocker found. Save a local commit after final whitespace/scope check. Continue publication hold.

## Ledger

- No shared interfaces across implementation tasks; single dependency task.
- Dependency audit is complete; this plan is bounded remediation, not a full security audit. No exploit validation or deployment behavior is claimed.
- Low advisories in nested BlockNote/Mermaid KaTeX require separate compatibility work. Direct KaTeX is already 0.18.7, but this does not replace nested 0.16.47 copies.
- Full development audit additionally identified brace-expansion/minimatch paths. Ruling: refresh existing compatible TypeScript ESLint 8.x transitives too, rather than leave the build-tool advisories hidden by --omit=dev. No root tool major versions or application behavior change.
- Initial full verification passed typecheck/lint but unit tests stopped: loopback HTTP/storage fixtures were blocked by local execution restrictions; the pool-lifecycle fixture also emitted release without borrowing a client. New Vercel helper intentionally captures request context at connect. The fixture now exercises both Promise/callback acquisition and releases after request scope ends, preserving the original two-cleanup assertion. Targeted real-helper fixture passed 1/1; no database socket or production configuration used.
- Lockfile audit after compatible runtime/development refresh: 4 low, 0 moderate/high/critical, all four entries tracing the nested KaTeX advisory. Native platform packages retained; xdg-app-paths 5.1.0 is an explicit dependency of the updated CLI Config, not unexplained drift.
- Sharp 0.35.5 native smoke check encoded a trusted in-memory 1x1 RGBA sample to PNG and decoded correct metadata successfully on local macOS. Linux deployment binaries and actual Vercel lifecycle remain untested; publication remains paused.
- Primary package metadata confirms BlockNote diagram 0.57.0 still requires Mermaid ^11, while Mermaid 12.3.0 uses KaTeX ^0.18.0. Therefore upgrading the editor family alone would not clear the diagram path; no unsupported cross-major override was applied.
- Independent final review found no source/lock compatibility blocker, including the added TS ESLint transitives and Promise/callback pool fixture. This does not establish application exploitability or replace browser regression.
- User explicitly selected: finish the current compatible repair only; defer the larger editor/diagram compatibility changes. Publication hold remains in force, including after tests pass. The four low-severity package entries are known remaining work, not an accepted release exception.
- Expanded browser run initially finished 665 passed, 1 intentional skip and 2 failures (desktop/mobile copies of one science-reader test). Its fixture read an untracked, absent output/verification/science-diagram.svg. Ruling: render the exact existing fixture source with the existing diagramSVG renderer inside the test route instead; do not add an opaque pre-generated file or alter application rendering. Independent science rerun passed 10/10, including formula/diagram save/reload, invalid-input recovery, reader zoom/fullscreen, denied identities, and two-image PDF. Remaining critical tests were 657 passed plus the intentional mobile board skip (phones show the list layout).
- Final post-fixture typecheck/lint and complete unit suite passed again (627/627; same pre-existing anonymous-export lint warning). The optimized build/postbuild had already passed with the exact final dependency lock; later changes are tests and documentation only.
- In-app browser opened the local sample editor and its draft preview without editing data. The local development log also exposed a pre-existing sample-only SSR initialization failure (`window is not defined` from BlockNote). Controlled baseline source archive at 0c811c1, installed with scripts disabled and no production configuration, reproduced the same HTTP 500 on Next 16.3.4; patched Next 16.4.6 behaves identically. The unchanged production admin editor uses EditorLoader with `ssr:false`; the development-only sample route directly imports ArticleEditor. This sample-route defect is recorded, not silently fixed or counted as a successful server render. It is outside the approved dependency-only repair; production runtime behavior was not tested. Both temporary preview processes were stopped.
- Final source review of the standalone science fixture confirmed identical source/assertions and no application rendering changes. Unique browser coverage after rerun: 667 passing checks and 1 intentional phone-board skip. No claim that the initial expanded run was green.
- Release decision (2026-11-24, subsequent to the hold above): after being told the complete audit still has four low-severity KaTeX-related entries, no moderate/high/critical entries, and unconfirmed application exploitability, the user explicitly replied “Ok 执行” to the choice of accepting that remaining risk, pushing main, and checking Verify/production deployment. This lifts the publication hold for this reviewed repair only and records the AGENTS.md rule 9 exception. Larger editor/diagram work remains deferred; no claim of zero vulnerabilities or complete application security is made.
