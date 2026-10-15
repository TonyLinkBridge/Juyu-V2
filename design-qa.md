# Developers redesign: local design and implementation QA

Date: 2026-10-04. Scope: the four approved Developers layouts, integrated with the existing JUYU backend and admin frame. No push, production deployment or real-account acceptance is recorded by this report.

final result: passed

This is a local design/implementation result. Screenshots use explicit fixture data and a test identity, not production telemetry. The rendered console and admin frame are the actual source components; the QA-only server and authentication stubs are outside the production source tree. Database behavior and authorization are tested separately.

## Visual truth and normalization

- Approved interactive source: http://127.0.0.1:8776/ (Overview, API Keys, Webhooks, Events / Logs).
- Rendered source-component implementation: http://127.0.0.1:8777/admin/developers/events-logs (sidebar opens all four pages).
- Evidence base: `output/verification/developers-redesign-2026-10-04/` (ignored generated artifacts).
- Source visual truth: `source/{overview,api-keys,webhooks,events}-desktop-final.jpg`, each 1440 × 960 pixels.
- Implementation: `implementation/{overview,webhooks,events}-desktop-final.jpg`, 1440 × 960 pixels; API Keys full-page capture is 1440 × 1633 pixels.
- Full-view comparisons: `implementation/compare-{overview,api-keys,webhooks,events}-final.jpg`, 2880 × 1000 pixels: source left, implementation right, top 960 pixels at 1 CSS pixel per image pixel. The extra 40 pixels contain comparison labels.
- Focused comparisons: `implementation/focus-{overview,api-keys,webhooks,events}.jpg`. Opened together in combined source/implementation images to inspect charts, compact controls, configuration rows, table typography and badges.
- Desktop CSS viewport: 1440 × 960. Screenshot export is CSS-normalized at 1:1; no double-density enlargement is compared.
- Mobile CSS viewport: 390 × 844. Full-page exports are 390 pixels wide: overview 2848 high, API Keys 2284, Webhooks 874, Events 1747. All four pages have document scroll width 390; wide tables scroll within their own regions.
- Final user-facing screenshot: `implementation/events-deliverable.jpg`, 1280 × 1132 full-page pixels from the restored 1280 × 720 browser viewport. Browser reports devicePixelRatio 2, but its screenshot export is normalized to 1280 CSS pixels.
- Comparison state: light theme, normal non-empty view, Overview 7 days, Events 7 days/all sources/all types/no severity selection, Webhooks all statuses, API connection-scope notes closed. Dark API and Events captures are supplementary readability checks.
- Content is not identical: the approved mock uses sample metrics and simplified service rows; the actual-component fixture uses the production DTO shape and additional existing services. Therefore this report judges approved structure and styling, not pixel equality of dynamic records or chart curves.

## Findings and comparison history

No actionable P0/P1/P2 findings remain in the approved local scope.

1. [P2, fixed] Excess top padding and a separate pagination block made the Events composition taller than the approved layout. Evidence: `implementation/compare-events-initial.jpg`. Fix: scope the admin-frame top padding to Developers and combine matching-count/pagination into a compact footer. Post-fix evidence: `implementation/compare-events-final.jpg` and `focus-events.jpg`.
2. [P2, fixed] API configuration rows stretched across the entire content area and exposed repeated technical notes, losing the approved flat, compact configuration layout. Evidence: `implementation/compare-api-keys-before-density-fix.jpg`. Fix: cap the configuration region at 770px, flatten the version row, tighten service rows and move check scope into expandable notes. Keep meaningful failure/status feedback visible. Post-fix evidence: `implementation/compare-api-keys-final.jpg` and `focus-api-keys.jpg`.
3. [P2, fixed] On a 390 × 844 screen the expanded existing admin menu exceeded the available viewport, hiding the Developers links below the fold. Browser click failed and the regression test confirmed the oversized menu. Fix: a Developers-scoped, independently scrollable expanded menu and sticky menu summary using the existing 760px shell breakpoint. Post-fix evidence: all four mobile captures; actual API Keys → Overview → Events navigation succeeded; desktop/mobile reachability tests pass.

Accepted product adaptations, not unresolved defects:

- Keep the real JUYU admin shell, logo, navigation and brand tokens. Its header/sidebar dimensions and complete menu differ from the mock's reduced example menu.
- Overview has real request count/failures and measured minimum/average/maximum response time, daily data tables and a Slack status chart. The Slack queue totals are all-time; the curve groups notifications created in the selected period by their current status. Captions explain this difference.
- API Keys lists the existing five integrations, including Cron and the database's separate scoped connection configurations. It displays key names and presence flags only; provider/Vercel configuration and existing connection probes remain the actions. The page does not issue or reveal secrets. Additional real configurations make its page longer than the simplified mock.
- Webhooks includes year/seconds, pagination and precise notification states rather than demo-only rows. Retry remains failed-only and keeps the same operation identifier after an uncertain response.
- The two bottom Events cards show interface/article operation counts and event-source counts. They do not show invented Pages/Referrers visitor data. Aggregates include every matching record, independent of the displayed page. Interface/article rankings are limited to the top 20 and the UI states that limit.

## Required fidelity surfaces

- Fonts/typography: retain the JUYU system Chinese font stack. Clear 24px page heading, smaller English subtitle, 13px table copy and compact semantic badges. Focused comparisons show readable labels and coherent optical weight; timestamps use tabular numbers. Minor inherited line-height differences from the mock are accepted with the real admin frame.
- Spacing/layout rhythm: overview chart pair + activity rail + wide Slack chart; 282px desktop Events rail; compact toolbar/table/footer; flat API rows. At 1150px the activity rail stacks; at 720px charts/cards become single-column and filters move above the table. At 760px the existing mobile menu is bounded. Desktop and mobile captures show no controls hidden by page overflow.
- Colors/tokens: existing JUYU panel, ink, line, action, muted and warning tokens; brand action red, red errors, dark warning badge in the log table, distinct configuration warning state. Dark API/Events remain readable. No new overall theme replaces JUYU.
- Image quality/assets: reuse the existing JUYU logo assets and existing Lucide icon family; sharp, proportional logo and controls. No generated logo, decorative substitute or placeholder illustration. Recharts renders actual time-series UI; accessible daily-value tables provide a textual alternative.
- Copy/content: Chinese labels explain actual behavior, selected statistical scope, 30-day technical-log retention, secret concealment and retry uncertainty. No prototype visitors, fake monetary total or reference-only intelligence is added to the product. The local fixture notice is QA-server-only.

## Interaction and code verification

- In-app browser: all four desktop and mobile routes; mobile sidebar navigation; event detail and Escape; empty search and clear; Webhook failed filter, retry dialog and cancel; API expandable connection scope; dark API/Events. No real notification is sent by visual QA.
- Browser console: error-level logs checked; empty on the final Events tab and earlier dark checks.
- 569/569 unit tests passed in `verify-final.log`, including CSV quoting/formula-prefix handling. Typecheck passed; lint has 0 errors and one existing warning in `tests/helpers/fixture-typescript-loader.mjs`.
- 17/17 targeted unit/database tests passed in `related-last.log`: Malaysian midnight boundaries, pagination-independent aggregates, measured response statistics, latest matching article title, configuration permissions and existing retry protections.
- 14/14 desktop/mobile browser tests passed in `e2e-complete.log`: filtering, pagination, empty/error behavior, date forwarding, rankings, export, stable details during live refresh, failed/uncertain checks, retry idempotency, forged-role rejection and mobile navigation reachability.
- Final production build passed after the last UI changes (`build-last.log`), including built-style and PDF/browser tracing checks.
- Code review findings fixed: live refresh preserves selected detail; article ranking title uses latest matching operation instead of alphabetic maximum; refresh selectors are unambiguous.
- Existing Super Admin checks remain at page/service/database boundaries. No schema migration is introduced by this layout change.

## Implementation checklist

- [x] Apply all four approved structures using existing JUYU tokens.
- [x] Use real backend DTOs and scoped aggregate queries.
- [x] Preserve secret concealment, role restrictions and failed-only idempotent retry.
- [x] Fix findings and recapture full/focused comparisons.
- [x] Verify desktop/mobile interactions, dark readability, code and production build.
- [x] Keep the local implementation available for review, with sample-data notice.
- [ ] Push/deploy and verify against a real production Super Admin account only when separately requested. This is a delivery-stage test gap, not evidence of completed production acceptance.

---

# Knowledge directory design QA — 2026-10-15

final result: passed

Scope: implement the selected JUYU category overview inside the existing Fumadocs HomeLayout, with links into authorized category article lists. The original Help Centre homepage and article reader stay available.

## Evidence

- Selected image: `output/verification/2026-10-15-knowledge-directory/selected-design.png`.
- Desktop capture: `output/verification/2026-10-15-knowledge-directory/desktop.jpg` (1440 × 1100 CSS viewport, full-page capture).
- Mobile capture: `output/verification/2026-10-15-knowledge-directory/mobile.jpg` (390 × 844 CSS viewport, full-page capture).
- Dark capture: `output/verification/2026-10-15-knowledge-directory/dark.jpg`.
- Source and desktop capture were opened together for comparison; mobile and dark captures were also inspected.
- Local browser preview uses illustrative data and the production component. It does not bypass the real library/category account gates.

## Fidelity surfaces and resolved findings

| Surface | Result |
| --- | --- |
| Typography | Reuses the original JUYU editorial serif heading and existing body typography. |
| Spacing/layout | Two-column desktop grid and single-column mobile layout. Initial extra action row increased card height; actions now align with the preview row. No mobile page overflow. |
| Colors/tokens | Existing brand, background, border and muted text tokens retained. Dark-mode action text initially too dark; corrected to the system's existing dark brand token and recaptured. |
| Images/icons | Existing brand and account controls retained. Category icons use the existing ReaderIcon set and actual backend keys. Categories without a configured icon remain without one. No new decorative raster assets. |
| Copy/content | Category names, order, child topics, and article titles come from the authorized backend tree. There is no category-description field, so no invented category introductions are persisted. The official Fumadocs search label remains unchanged. |

Expected differences from the illustrative image: actual category count/names/icons reflect backend configuration and reader access; the local preview account lacks the real administrator button; spacing follows existing JUYU tokens. These are intentional product constraints, not unresolved fidelity defects.

## Functional and access verification

- 12 relevant desktop/mobile browser cases passed, covering the original home, navigation feedback, category/article flow, empty state, language, search toggle and dark theme.
- 35 isolated database cases passed, including multiple category memberships, private categories, draft exclusion, library separation, membership/enrollment gates, legacy slugs and localization.
- Article URL values are used directly from authorized navigation nodes; slug generation/resolution, storage access policies and publication rules are unchanged.
- No production database migration or category/article write is required.
- Real-account production browsing is a separate deployment acceptance step; the local screenshots above are not production evidence.

No unresolved P0/P1/P2 visual findings. Full assistive-technology certification and every browser/OS combination were not in scope.


---

## 2026-10-15 — Apply the approved category overview to the homepage

- `/help-centre` now reuses `KnowledgeDirectory`; categories precede recent updates and reading history. `/help-centre/library` and category/article destinations remain available.
- Existing Fumadocs layout, official search, JUYU fonts/colors, announcements and account controls remain in use. Homepage omits the redundant return-to-home link.
- Homepage and category overview use the same verified-reader gate and complete authorized category memberships. No database migration or publication/slug mutation.
- Local verification: production build, lint/typecheck and 592 unit tests passed; 95 isolated database tests passed; 12 desktop/mobile browser cases passed, covering categories, search, theme, empty state, locale, recent history and navigation.
- In-app browser inspected the local homepage. Formal homepage acceptance follows deployment; local fixtures are not production content.


---

## 2026-10-15 — OPS, Reference and Q&A collection entrances

- Reused the approved JUYU editorial header, content tabs and category cards inside the official Fumadocs HomeLayout. OPS/Reference retain original detail destinations; Q&A retains independent links and in-place answers.
- OPS/Reference categories come from the current authorized publication tree, filtered to their respective kind with all category memberships retained. Scoped title/summary search and pagination operate only on that authorized collection.
- Q&A uses its existing published question categories. Its overview uses cards; selecting a category or searching switches to compact category filters so answers stay accessible.
- Preserved reference table filtering, native rich cells, PDF and edit actions on existing selected-reference URLs. No production data writes, slug changes or database migrations.
- Verification: 595 unit tests and the production build passed; 58 isolated database cases passed; 42 desktop/mobile browser cases passed. In-app browser inspected local OPS/Reference overviews and Q&A overview/expanded answers.
- Formal OPS/Reference currently show no published content for the tested account. Positive categorized-content flows use disposable database fixtures and local browser fixtures; live empty states and Q&A flows will be checked after deployment.
