# Table colors and dark catalog cards

Approved scope, in order:
1. Restore saved table cell foreground/background colors in the editor. Reuse reader color semantics and validation. Keep the document, merged cells, borders, vertical alignment, permissions and save workflow unchanged.
2. Keep all six existing catalog illustration subjects and compositions; create corresponding dark variants, as selected by the user. Use JUYU dark surface colors. Preserve original light assets. Ask before changing subjects/layout or expanding scope.
3. Adapt existing status filter pills and card status badges to dark mode while retaining their status meanings and readable contrast. Preserve existing light colors and all actions.
4. Verify editor/preview parity with isolated fixtures; test four content kinds, both themes, desktop/mobile, existing destinations and data. Independent review, build and appropriate regressions before authorized main publication. No real draft or publication mutations.

## Ledger

- Reused clean isolated worktree at 8b179cc. Actual main has unrelated AGENTS.md and account-clerk.ts edits; preserve them.
- Browser diagnosis: editor cells keep data-background-color="rgb(31, 78, 121)" but computed background is transparent; preview correctly applies that RGB color. Card body themes correctly, cover CSS and raster backgrounds remain pale; status colors are hard-coded light colors.
- User explicitly approved corresponding dark variants of the original six illustrations. Original light files are unchanged; generated dark assets are each 800x320, approximately 5–8KB, and their prompts/provenance are in docs/sources/content-catalog-dark.json.
- User explicitly approved checking and fixing the nested tab table after the same missing-color regression was reproduced. It uses a color-only extension so its existing schema does not gain border/alignment fields.
- Main and nested table browser regressions failed first, then passed. Safe color validation and reader-neutral-ink semantics are shared with preview; no stored content is rewritten.
- Final review: independent reviewer inspected source and all six illustration pairs, finding an inline-black inheritance edge. Runtime regression reproduced it. User approved fixing color precedence; render-only neutral black now uses the same context as preview. Targeted desktop/mobile color regressions passed 8/8.
- Catalog theme test failed before adaptation and passed afterward; all four content types retain destinations/actions, and status text contrast is at least 4.5:1 in the dark palette.
- First expanded browser run exposed a missing dependency in the navigation test fixture and interference from rebuilding while fixture tests read build files. Added the missing fixture dependency and reran checks sequentially.
- Final optimized build, postbuild checks, typecheck, lint (one pre-existing fixture-loader warning) and 627 unit tests passed. In-app browser confirmed a pasted blue/white test table has identical computed colors in editor and preview using local sample data without production credentials.
- Final sequential desktop/mobile regression completed: 218/218 passed. Production drafts, states, permissions, history and original links were not mutated.
- Publication gate: current dependency audit still reports 12 pre-existing affected dependency entries (5 low, 6 high, 1 critical), unchanged from the prior report; package.json and lockfile are unchanged. Next 16.3.4 matches published advisory ranges. For the checked GHSA-vcvr-r3jv-pc5j, no next/og ImageResponse use was found in source; application exploitability of the remaining advisories has not been assessed. No exploitation/probing was performed. Per the actual project's AGENTS.md rule 9, seek explicit release exception or separate dependency remediation before production deployment. This UI fix does not claim to resolve that backlog.
