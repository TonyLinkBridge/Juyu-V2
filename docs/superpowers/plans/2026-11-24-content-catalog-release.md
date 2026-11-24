# Content catalog release implementation plan

**Goal:** Release the selected catalog presentation using real authorized workspace data and all existing workflow operations.

**Architecture:** Extend the existing workspace view parameter with `cards`. Reuse TasksList's selection, confirmations, API handlers, freshness and draft actions in the card presentation. Keep list/board and existing URLs valid. Only presentation and the default workspace view change; no schema, authorization or mutation service changes.

**Design authority:** User selected preview 5 and authorized production release on 2026-11-24. Preserve original functionality; do not ship the isolated mock route or mock forms. Real category metadata is shown; do not introduce a category filter absent from the server query.

## Constraints

- Do not stage unrelated main-checkout changes in AGENTS.md or account-clerk.ts.
- Use existing UI Arc FilterMenu/FilterToolbar, existing JUYU tokens and no new dependencies.
- Preserve original role gates, optimistic version checks, historical records, real drafts, publication states and article URLs.
- Keep old `view=list` and `view=board` links; use cards for the default admin landing page, including four content kinds when no explicit view is supplied.
- Use lightweight static decorative covers; no additional media/database requests or fabricated article summaries.
- Record previous deployed Git revision and release as one reversible commit.

## Review focus

- Card mode must preserve privileged batch selection and ordinary Admin withdrawal visibility.
- Filter navigation, pagination, background refresh and mutation rereads must preserve cards query.
- Long titles, multiple categories and long account names must remain readable on mobile.
- Every item status uses the same original destination and mutation flow.
- Zero-result, service-failure, disabled and conflicting-version states remain distinguishable.

## Tasks

1. Add a query round-trip test for cards; watch it fail, then extend the accepted view union. Default admin landing view to cards without changing existing explicit list/board links.
2. Add cards to TasksList using its unchanged action/selection handlers. Add compact workspace/filter styling and existing UI Arc menu while retaining all condition actions and visible view switching. Use real metadata only.
3. Test card destinations, batch role gating, query preservation, long text/mobile layout and existing list/board flows with isolated fixtures. Run typecheck/lint/unit/build plus relevant browser checks. Inspect actual components in the in-app browser and review diff independently.
4. Commit only production presentation, assets, tests and this plan; push main fast-forward. Check deployed revision and production UI read-only, retain rollback SHA. Never mutate production records for verification.
