# Analytics and media design QA — 2026-09-30

final result: passed

## Target and evidence

Source visual truth: `/var/folders/by/2103qtln3xd6rsg6nfxqt3yw0000gn/T/codex-clipboard-d86d90f2-ad73-47aa-8717-9ad41438cc13.png` (1942 × 809 pixels, image board of two screens, not a browser CSS viewport).

User selected the information structure and explicitly required existing JUYU branding/style. This is structural fidelity with intentional token alignment, not pixel cloning of the board's blue/colorful treatment.

Rendered real components in a localhost-only fixture using the existing built CSS, assets and shell class structure. Fixture banner and all people/file values are clearly sample data, never shipped in production. PostgreSQL behavior was tested independently against scoped runtime/issuer roles. The fixture did not call or bypass production authorization.

Implementation screenshots:
- `output/verification/admin-data/analytics-desktop.jpg`
- `output/verification/admin-data/media-desktop.jpg`
- `output/verification/admin-data/analytics-dark.jpg`
- `output/verification/admin-data/media-dark.jpg`
- `output/verification/admin-data/analytics-mobile.jpg`
- `output/verification/admin-data/analytics-mobile-dark.jpg`
- `output/verification/admin-data/media-mobile-dark.jpg`

Desktop viewport 1440 × 1000 CSS pixels; mobile viewport 390 × 844 CSS pixels; screenshot density 1 CSS pixel per raster pixel. Full-page captures include page height. Source board and implementation are normalized by proportional display in the same browser comparison sheet, without stretching assets. Source has conceptual data and a different shell width; no false pixel-level equality is claimed.

Combined full-view comparison: `output/verification/admin-data/comparison.jpg`. Source and both browser-rendered screens appear together in that single capture. Focused region verification was performed in the browser at native scale for metrics, chart, person table, file previews and upload dialog; additional cropped comparison was unnecessary because these regions are also visible in the combined sheet.

## Comparison history and fixes

1. P2: 50-person detail list stretched the whole page. Fix: bounded scroll region in the detail panel (340 px), keyboard focus and sticky table header; verified pagination remains visible.
2. P2: nested AdminFrame and main padding accumulated. Fix: page-scoped main inherits the existing shell inset once; recaptured final desktop screens and combined comparison.
3. Structure drift: initial bar trend did not follow selected line-chart structure. Replaced with native SVG line/area chart in existing brand tokens, with an expandable daily-data table. Recaptured final analytics screen.

No actionable P0/P1/P2 findings remain for the tested scope.

## Fidelity surfaces

- Typography: existing app font stack retained; heading 30 px desktop / 25–26 px mobile, data table 12–13 px and supporting text 11–12 px. Hierarchy and wrapping inspected; article/file names wrap rather than truncate essential identity.
- Layout: existing admin header/sidebar untouched in production. Three analytics metrics, tabs, trend, popular table and selected-person panel match the selected structure. Media has category rail, search/sort/view controls, file grid/list and selected-file detail. Panel stacks at 1200 px; rail becomes horizontal at 760 px; mobile grid has two columns. Main insets are owned by AdminFrame.
- Color: existing red, gray, surface, action and focus tokens retained, including dark mode. Blue selected rows and colored metric icons from the board intentionally omitted to satisfy the user's style-unification instruction.
- Assets: original JUYU color/white logo reused. Private file thumbnails use the real authenticated delivery route; file icons come from the established Phosphor library. Fixture logo thumbnails are illustrative sample files, not substitute production content. Video/audio failures now show a readable preview failure state.
- Copy: clear terms for opens, people and visible time. Historical missing duration says 未记录 rather than an invented zero. Search hashes are placed under diagnostic disclosure. No implementation prompt text appears in production flows.

## Browser interaction acceptance

- Analytics tabs and optional diagnostics; document detail open/close; employee pagination; deliberately failed people request and retry; daily trend data disclosure.
- Media selection, filename search (including no results), type filter, list/grid switch, usage metadata, preview/download links.
- Upload chooses article and file, disables incomplete submit, uses original binary upload contract, refreshes to selected new file. Tested against local fixture responses; actual storage verification retained and unit/DB tested, no production test files uploaded.
- Desktop and mobile, light/dark; document scrollWidth equals viewport width (1440 or 390). Upload dialog has no internal horizontal overflow at 390 px.
- Browser console errors/warnings: none in final checked analytic state. Expected injected 503 was exercised as a separate error test.

## Verification and release boundary

553 unit tests passed. Full existing DB regression: 437 passed before final migration-boundary helper; final core + analytics/media DB checks: 28 passed, including the new bounded migration test. Typecheck, lint and production build passed; CSS/browser tracing checks passed. Final CSS inset-only change was recaptured. The final acceptance callback correction was followed by the complete verify:build check: acknowledged opens enable timing, rejected or cancelled opens do not.

Production migration 0055 is required before deployment. Local screenshots and database tests do not prove production installation or real-account acceptance. No production credentials, sample people or sample assets are committed.

## Follow-up polish

The current data model has no image dimensions or video thumbnail frames; those are not fabricated. Original-file preview is provided, and videos/audio use native players in the selected detail panel. Search query text is not stored, so historical anonymous groups cannot be converted back into keywords.
