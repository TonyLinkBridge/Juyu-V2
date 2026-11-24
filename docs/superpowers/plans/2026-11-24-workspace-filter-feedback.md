# Workspace filter interaction refinement

Approved scope: use ordinary Arc Select for content kind, announce filter navigation immediately, prevent duplicate filter submissions, open the only status field directly, and use 150ms lightweight menu motion. Keep every option, query parameter, role, workflow and existing destination. No production data changes.

1. Add browser regressions for select keyboard/form behavior, query preservation, direct status selection, pending feedback and duplicate blocking. Observe failures against the existing implementation.
2. Adapt official UIArc select registry source with portal theme scope and reduced-motion support. Pin Radix Select, review package/source, and compare dependency audit against baseline.
3. Add opt-in compact FilterMenu presentation; preserve the existing shared morph presentation. Apply pending state to existing Next navigation only, with disabled filter controls and an announced status. Preserve GET form fields.
4. Run affected desktop/mobile browser suites and full build verification. Inspect isolated browser previews and obtain an independent final diff review. Push the verified branch to main, then check deployment and live controls without changing records.

## Verification ledger

- Initial checkout clean at 0fe4374; reused existing isolated worktree. Main checkout's unrelated authentication and instruction edits remain outside this change.
- Official registry source and Radix Select 2.4.1 metadata reviewed; no installation lifecycle scripts used.
- New select/direct-status/pending/duplicate-guard regressions failed against the old UI, then passed against the implementation.
- Final review: fresh-context reviewer found compact-menu edge clipping. Fixed with a regression that failed at a 627px bottom edge in a 600px viewport, then passed with side-aware placement and a scrollable bounded list. Targeted suite 56/56 passed.
- Full-shell browser inspection found a route stylesheet ordering issue that squeezed the select to 107px. The actual Next-page regression failed first; scoped specificity and single-line labels fixed it. The actual Next navigation / no-JavaScript GET / full-shell suite passed 6/6 on desktop/mobile.
- Final verification: 625 unit tests, typecheck, lint (one unchanged fixture-loader warning), optimized build and postbuild checks passed. Desktop/mobile fixture regressions 56/56 passed, including dark portal colors, keyboard operation, pending feedback and original workflow destinations. No API, schema, service authorization or publication handler changes.
- Dependency audit compared with HEAD: 12 pre-existing production advisories in both reports; zero new advisory package entries. This UI task did not upgrade unrelated packages or claim to resolve that pre-existing audit backlog.
- Added the new browser regressions to the existing GitHub Verify commands. The local design preview loads the same catalog stylesheet as the real admin layout.
