# Focused article editor — 2026-09-11

Source visual truth: output/verification/focused-editor/selected-reference.png (merged direction accepted in conversation: focused writing, settings drawer, optional preview).
Implementation screenshots: output/verification/focused-editor/{desktop,settings,mobile,mobile-settings}.png.

## Scope and evidence
Actual ArticleEditor and SubmitReview components mounted in an isolated local fixture. Saves and review submissions use in-memory data, not production. The fixture header labels this explicitly; it is not the authenticated AdminFrame header.
Desktop viewport: 1440 × 1000 CSS pixels. Mobile breakpoint: 390 × 844 CSS pixels. Screenshots captured at those dimensions; image-generated source has no authoritative CSS viewport or device density. Comparison is composition/proportion based, not a claim of pixel equality. No density normalization applied.
States: saved draft, drawer open/closed, blank new article, long title, preview, failed save and successful local review submission.

## Findings and comparison history
- P2 resolved: old category styling stacked the checkbox and label vertically. Scoped drawer styles now put checkbox, name and access hint together; see settings.png and mobile-settings.png.
- P2 resolved: one-line title could clip long text. ResizeObserver adjusts height; verified wrapping at 390px.
- P2 resolved: workflow badge originally displayed draft for other statuses. All six workflow states now have accurate labels; local successful review shows waiting for second review and disables editing.
- P2 resolved: compact toolbar inherited a long submission-success paragraph. It now shows a short status, with locking explanation in the content notice.
- Expected difference: the settings drawer is modal and overlays the page to preserve keyboard focus and native editor state. Close/Escape returns to settings button.
- Expected difference: native BlockNote heading/menu typography is retained rather than imitating generated editor controls.
- Expected difference: actual JUYU brand image is used; generated logo lettering is not reproduced.
- P3: drawer explanatory copy is more detailed than the concept because it explains actual category permission behavior.

## Five fidelity surfaces
Typography: title hierarchy, readable body, smaller muted metadata, native editor headings; long-title wrapping checked.
Spacing/layout: centered document, settings hidden initially, compact sticky actions, right drawer. 390px failure state measured document scrollWidth=390 and viewport=390.
Colors/tokens: existing light/dark tokens, white panel, muted borders, brand-red submit action; this visual pass covers light mode.
Image fidelity: existing JUYU source logo; no new decorative raster assets.
Copy: real article categories/access summaries, explicit local fixture notice, clear saved/error/locked states. No fake published content.

Full-view evidence is in the four screenshots. Focused inspection covered the title/metadata, category checkbox row, toolbar and dialog controls at readable screenshot scale; separate crops were unnecessary.

## Interaction checks in the in-app browser
- Blank draft starts with submit disabled.
- Native slash menu includes existing native blocks and custom extension entries; inserting a callout works.
- Tags and audience update and autosave; Escape closes settings and restores trigger focus.
- Preview closes without clearing the edited title/content; mobile preview switches to one pane.
- Long title wraps on mobile.
- Reviewer selection requires another administrator; local submission locks title/body editing.
- Forced 503 save retains input, exposes retry/recovery and disables submit.
- Console inspection found the initial fixture's invalid category ID; fixed to valid UUID. No subsequent runtime error observed; forced 503 is intentional.

## Validation and limits
350 unit tests passed. TypeScript, lint and production build passed.
This is local UI acceptance, not production deployment, authenticated two-admin acceptance, real-device mobile acceptance or database migration validation.
The legacy editor browser suite references the former always-visible settings/insert buttons and was not run in this pass; those automation selectors need migration before claiming full browser regression coverage.

## Implementation checklist
- [x] Focused writing surface and scoped admin layout.
- [x] Settings drawer, preserved native editor and input.
- [x] On-demand preview and review selection dialog.
- [x] Local desktop/mobile breakpoint interaction checks.
- [ ] Migrate/run complete legacy browser suite.
- [ ] Authenticated deployment smoke test after release.

Final result: passed

Result applies to the inspected focused-editor UI only; release acceptance remains separate.

## Format fidelity follow-up — 2026-09-11
The earlier pass missed editor/reader typography drift. This follow-up supersedes that aspect:
- Native headings retain semantic HTML hierarchy but use their stored level for visual size.
- Native reader removes legacy flex gap/margin stacking and shares editor font/line height/default color.
- Completed items now use actual disabled checkbox controls and preserve strike-through. Disabled gray styling is an intentional read-only affordance; employees cannot toggle article state.
- Preview is labeled 发布效果预览. Preview and reader use the same DocumentView/StructuredDocument; no preview-only content renderer.
- At 1440×1000, measured editor and preview H2 text: 32px, line height 48px, rgb(34,36,42). Red text on both: rgb(224,62,62).
- Visually verified yellow highlighting, bold, italic, underline, strike-through, numbered list and completed checklist. Saved/reloaded local checklist and formatted text retained.
- Added roundtrip test for all nine palette colors plus HEX/RGB, combined inline formats and block alignment/background. 351 unit tests pass.
Evidence: output/verification/focused-editor/format-consistency.png.
Remaining scope: authenticated publication on Vercel has not been performed; this is not a claim of real-account release acceptance. All native media/table variants have not been exhaustively visually compared in this follow-up. Existing tests cover serialization but do not prove pixel equality for every block or browser.
