# Quote and authored blank-line parity — 2026-10-16

## Requirement

Preserve authored empty paragraphs and make quotes consistent in the editor, draft/review copies, and formal reader. Preserve saved content, emphasis, list numbering, access rules, and existing URLs.

## Confirmed causes

- The editor preview and hydrated formal reader explicitly removed empty paragraph blocks.
- Editor, structured preview, and published reader had different quote colour, border and spacing rules.
- Empty paragraphs need an explicit line box; exported nested BlockNote HTML does not execute live editor decorations.

## Changes

- Retain stored blank blocks in both rendering paths. No data migration or article-body rewrites.
- Share quote typography, border, padding and whitespace handling. Preserve authored inline emphasis and colours, including the existing JUYU red background palette.
- Add presentation-only paragraph decorations to the main and embedded editors and the formal reader. Mark detached nested HTML exports using stored blank block IDs.
- Distinguish actual blank paragraphs from nonempty soft-break paragraphs, links and custom inline content. Markers disappear when a blank becomes text.
- Keep empty callout/accordion readability guards unchanged.
- Update browser fixture dependency lists and the stale OPS fixture expectation to the already-existing `/help-centre/library` destination. No route change.

## Validation

- TypeScript and lint: passed; one pre-existing anonymous-default-export lint warning remains.
- Isolated unit suite: 605 passed.
- Production build, required CSS and traced browser assets: passed.
- Fumadocs preview suite: 84 passed, desktop/mobile including light/dark quotes, whitespace-only paragraphs, nonempty soft breaks, nested static exports, emphasis and numbered starts.
- Critical workflow coverage: 374 cases covered. The full run passed 338; a missing fixture dependency and an embedded-edit test that had not opened the editor were corrected. All 34 affected workflow cases and the 10 targeted editor cases were rerun successfully (including the two previously failing embedded cases). No product permission or routing changes were needed.
- Reader navigation suite: 22 passed, including original routes and authorization failures.
- Local browser: adding an empty paragraph increases preview spacing; saved fake data survives reload. The real ArticleEditor and reader components were used without writing a production article.

Production browser acceptance is performed after deployment. No test publishes, edits, or changes access to a real article.
