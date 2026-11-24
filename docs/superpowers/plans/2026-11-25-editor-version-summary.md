# Editor version and language summary

**Goal:** Organize the screenshot's three loose notes into one compact, theme-aware information card, using the existing editor style and preserving all current actions and rules.

**Scope:** Presentation and explanatory copy only. No new features, dependencies, API calls, permissions, stored content, translation behavior, publication state or links. Do not edit real drafts. Prepare a local result for review; no publication requested for this change.

**Design choice:** Reuse the existing quiet card/pill treatment. Show publication information and English-version progress as two clearly labeled items. Keep the existing English progress calculation and publication label. Retain all guidance, shortening the publication explanation to accurately cover both two-review publishing and the existing direct-approval path. Desktop items sit side by side when space permits; narrow/preview widths stack naturally. Do not collapse information or add buttons.

**Files:**
- src/components/editor/ArticleEditor.tsx: group the existing notes; keep their conditions/links and all urgent alerts.
- src/app/feedback.css: scoped card layout using current theme tokens; no global style replacement.
- tests/e2e/editor.spec.ts: update the existing published-draft retention test to the accurate guidance text; retain its save/state/history assertions.

## Steps

- [x] Update the existing published-draft guidance expectation and observe it fail against current copy (desktop/mobile, expected text absent).
- [x] Implement the compact grouping, preserving all conditional messages and existing entry points. Urgent errors/recovery prompts remain above the informational card.
- [x] Updated retention and relevant English/Super Admin/Admin/OPS cases: 12/12 passed using isolated fixtures.
- [x] Visual verification used the actual editor component, all four content kinds, both themes, both viewports, published/new-draft/in-review and English states: 4 capture scenarios passed with 28 local page mounts and zero data writes. Temporary capture spec removed; screenshots retained under output/verification/version-summary-*.
- [x] Typecheck, lint, full unit tests (627/627) and optimized build/postbuild passed with empty production credentials. One unchanged fixture-loader lint warning remains.
- [x] Independent read-only source/screenshot review found no introduced issue. Save the local change and show the result; do not push without authorization for this change.

## Ledger

- Base 2193bb9; reuse clean linked worktree, new branch codex/editor-version-summary-20261125. Main's unrelated AGENTS.md and account-clerk.ts remain untouched.
- Existing editor uses three paragraphs with generic margins. English progress and published-version state already come from EditorData; no backend changes are needed.
- Copy judgment: “new drafts always need another second review” is too broad for the existing Super Admin approve-and-publish path. Use “the new version takes effect after approval and publication”, retaining the old formal version until that point.
- This is a small continuation of the already selected admin style, not a new design system. No new tests are added solely to mirror CSS; the existing published-draft workflow test remains the behavior check.
- Visual inspection: two columns at desktop width, two stacked items on mobile, theme-token backgrounds/badges; no horizontal overflow or clipped English guidance. English progress calculation, publication labels and action links are unchanged.
- Reviewer confirmed the existing English-status priority is retained (an existing English publication remains labeled published while a revision exists). No workflow/status-model changes were made as part of this layout request.
- Stable local preview images are copied to the task visualization directory as juyu-editor-version-summary-{light,dark,mobile}-20261125.png. No production pages/data were edited or saved.

## Authorized release and CI follow-up

- User authorized pushing with “推”. Commit 2e81669 was pushed to main; Vercel deployed that exact release. An authenticated read-only production check confirmed the new card in both themes, restored the original theme and left the editor clean without saving.
- Verify run 45434765043 passed build/unit checks and 656 browser cases, skipped one existing case, and failed the mobile native paragraph-drag case. The trace showed the drop at y=787 inside the fixed bottom tool rail after the summary moved the body lower. The original test reproduced this failure three out of three times locally.
- Center the final paragraph before measuring drag endpoints. Keep the actual pointer drag, persisted order after reload, native deletion, undo and unique-block-identity assertions unchanged. The production implementation is unchanged by this correction.
- Corrected native-drag case passed six out of six runs: three desktop and three mobile. All runs used local HTTP fixtures and empty production credentials. A fresh full Verify run remains required after pushing this test correction.
