# Editor authoring rail design QA

- Source visual truth: `/Users/tony/.codex/generated_images/01a07e8f-7d3d-7913-ae5a-b945e4845a98/exec-82a42b5c-c6d3-4173-977a-b4c705ae449a.png`
- Desktop implementation: `/Users/tony/Documents/ChatGPT/Juyu V2/output/verification/editor-authoring-rail-desktop.png`
- Mobile implementation: `/Users/tony/Documents/ChatGPT/Juyu V2/output/verification/editor-authoring-rail-mobile.png`
- Comparison image: `/tmp/editor-design-comparison.png`
- Source pixels: 1487 x 1058.
- Desktop implementation pixels and CSS viewport: 1440 x 1000 at device scale factor 1.
- Mobile implementation pixels and CSS viewport: 390 x 844 at device scale factor 1.
- State: light theme, article editor, content-insert panel open.
- Scope: the selected fourth concept's workflow/action hierarchy and insert-panel layout. Source and implementation use different sample article content, so content density was not treated as a fidelity signal.

## Full-view comparison evidence

The source and implementation were placed in one side-by-side image before review. Both keep workflow actions in the top bar, use a narrow fixed authoring rail at the far right, and open a wider insert panel immediately beside it while preserving the document as the primary area. The implementation uses the existing product tokens and production components rather than copying decorative placeholder content from the concept.

The mobile capture uses the responsive counterpart of the same hierarchy: the rail becomes a four-action bottom dock, and the insert panel becomes a scrollable bottom sheet above it. The final document content and notifications retain bottom clearance.

## Focused region evidence

The desktop and mobile captures render the complete control labels clearly enough to inspect the rail, panel heading, block cards, spacing, borders, active state, and close action. No separate crop was required.

## Required fidelity surfaces

- Fonts and typography: existing product type stack retained; heading, label, helper, and action hierarchy match the concept's relative emphasis.
- Spacing and layout rhythm: 72 px rail and 340 px desktop panel preserve the concept's narrow-rail/wider-panel proportions; mobile uses a 64 px bottom dock.
- Colors and tokens: existing panel, border, muted, focus, hover, accent-soft, and brand tokens are used in light and dark themes.
- Image and icon fidelity: no raster artwork is required; product-standard Phosphor icons are used for the same semantic actions.
- Copy and content: Chinese labels explain what each action inserts. Existing English localization is present for the same controls.

## Interaction and runtime checks

- Desktop and mobile can open the insert panel, see all five actions, insert a callout, and render the inserted block.
- The targeted browser test checks page errors and console errors; none were reported.
- Existing BlockNote editing, autosave, recovery, snippets, article settings, Q&A settings, upload, preview, and mobile flows passed the full editor regression suite.

## Findings

No actionable P0, P1, or P2 mismatch remains within this item's scope.

## Comparison history

- Initial responsive check found notifications and the fixture's final page action could sit under the mobile dock.
- Fix: raised editor notifications above the dock and added bottom safe space to the editor page.
- Post-fix evidence: the final mobile capture and the complete mobile editor regression suite show reachable controls and content.

## Follow-up polish

- P3: production content density and the real authenticated header should be reviewed after deployment because the current evidence uses the controlled editor fixture.

item result: passed

# Callout context inspector design QA

- Source visual truth: `/Users/tony/.codex/generated_images/01a07e8f-7d3d-7913-ae5a-b945e4845a98/exec-faac7bc6-82b9-41ab-abc9-779c1d6ef627.png`
- Desktop implementation with inspector: `/Users/tony/Documents/ChatGPT/Juyu V2/output/verification/rich-hint-inspector-desktop.png`
- Mobile implementation with inspector: `/Users/tony/Documents/ChatGPT/Juyu V2/output/verification/rich-hint-inspector-mobile.png`
- Editor and publication-preview comparison: `/Users/tony/Documents/ChatGPT/Juyu V2/output/verification/rich-hint-nested-desktop.png`
- State: light theme, warning callout selected, title and shield icon set, body edited as a nested BlockNote paragraph.
- Scope: the selected second concept's direct content editing, focused appearance inspector, semantic styles, optional title, compact add action, and responsive behavior.

## Full-view comparison evidence

The selected concept and rendered editor share the same division of responsibility: content stays in the document while appearance controls live in a context inspector. The production implementation retains the existing authoring rail and product tokens. On mobile, the inspector becomes a bottom sheet above the authoring dock; closing it returns the user to the callout body.

## Focused region evidence

The desktop and mobile screenshots show all inspector controls without clipping. The editor/preview screenshot confirms that icon, title, warning color, and nested body order match the publication preview. Automated layout assertions verify that the icon, title, and compact add button remain in one row.

## Required fidelity surfaces

- Typography and spacing: title, nested body, helpers, and inspector labels keep the approved hierarchy and existing document rhythm.
- Color and state: info, success, warning, and danger use semantic tokens; the selected style has a clear focus border.
- BlockNote behavior: the callout body is a real nested BlockNote document, so rich text, links, lists, tables, and child blocks remain available.
- Responsive behavior: desktop keeps the document and inspector visible together; mobile uses a single-column bottom sheet with reachable controls.
- Existing content: legacy plain callout bodies are moved into an editable paragraph on the canvas without dropping their text.

## Findings and fixes

- Initial capture found BlockNote forcing the custom renderer's direct children to `display:block`, which stacked the icon, title, and add action.
- Fix: introduced an internal callout layout container and added an explicit grid override plus automated position checks.
- Initial mobile capture also showed the inspector's two-column parent grid squeezing sections and the delete label.
- Fix: the callout inspector now owns a single-column layout at every width while the four semantic style choices remain a two-column group.

## Remaining boundary

- Real authenticated production rendering still requires deployment. This item is locally verified in the controlled editor fixture and production build.

final result: passed

# Fumadocs article typography and actions design QA

- Source visual truth: `/var/folders/by/2103qtln3xd6rsg6nfxqt3yw0000gn/T/TemporaryItems/NSIRD_screencaptureui_Q2RRWp/Screenshot 2026-09-28 at 9.16.13 AM.png`
- Rendered implementation: `/Users/tony/Documents/ChatGPT/Juyu V2/output/verification/fumadocs-article-integrated-desktop.png`
- Side-by-side comparison: `/private/tmp/juyu-fumadocs-reader-comparison.png`
- Source pixels: 1924 x 1910, captured at double density and normalized to 962 x 955.
- Implementation pixels: 1440 x 5479 from a 1440 x 1000 CSS viewport at device scale factor 1. The article column was cropped from the first viewport, resized to 962 px wide, and compared at 962 x 955.
- State: light theme, article title, description, page actions, first chapter heading, paragraphs, inline links, and content blocks.
- Scope boundary: the reference and fixture contain different article copy. The comparison therefore covers Fumadocs typography, spacing, colors, action hierarchy, and reader rhythm rather than literal text or block-for-block content equality.

## Full-view comparison evidence

The source and implementation were normalized and placed in one side-by-side image. Both now use the Fumadocs title and description hierarchy, the `Copy Markdown` plus `Open` action pair, a thin divider, 24 px chapter headings with 32 px line height, 16 px body copy with 28 px line height, restrained inline emphasis, and official link underlines. The implementation retains JUYU-only protected features inside official Fumadocs components instead of presenting a second reader style.

The current official page was rechecked live at `https://www.fumadocs.dev/docs` on 2026-09-28. Its computed desktop values are 16 px for the docs shell, 28 px / 42 px for `DocsTitle`, 24 px / 32 px with 48 px top and 24 px bottom margins for level-two prose headings, 20 px / 32 px with 32 px top and 12 px bottom margins for level-three prose headings, and 16 px / 28 px with a 20 px bottom margin for body paragraphs. The implementation test now asserts these same values directly.

## Focused region evidence

The combined comparison is cropped to the article column and first viewport, so the title, description, actions, divider, first chapter heading, paragraph rhythm, links, callout, and tabs remain readable without another crop.

## Required fidelity surfaces

- Fonts and typography: the existing Fumadocs/Geist stack remains active. The shell now uses the official 16 px base and 1.5 line-height. BlockNote level-one and level-two chapters use the official Fumadocs h2 visual rhythm: 24 px, 600 weight, and 32 px line height. BlockNote level-three headings use the official 20 px / 32 px rhythm. Body copy uses the official 16 px / 28 px prose rhythm.
- Spacing and layout rhythm: chapter, paragraph, quote, divider, and list spacing are mapped to Fumadocs prose values. The action row keeps the official compact spacing and divider.
- Colors and visual tokens: default reader text, headings, dividers, quotes, and links use Fumadocs tokens. Authored red, purple, blue, background highlights, and bold styling remain visible in the published reader so the article matches its approved editor content.
- Image and icon fidelity: no new raster asset was required. Existing Phosphor icons are used inside Fumadocs button and popover primitives.
- Copy and content: article facts and editor content were not rewritten. A description appears only when the article already has description metadata; none is fabricated.

## Interaction and runtime checks

- `Open` reveals the existing Markdown and PDF destinations through the official Fumadocs popover pattern.
- Favorite, Markdown copy, PDF access, feedback, search, article references, dark theme, and read-only BlockNote behavior remain intact.
- Desktop and mobile article checks passed. The full Fumadocs browser suite passed 54/54 checks, and no horizontal overflow was introduced.

## Comparison history

- Initial P1: BlockNote chapter headings rendered at 48 px and dominated the page. Fix: scoped the published BlockNote heading levels to Fumadocs h2/h3/h4 rhythm. Post-fix evidence measures the first chapter at 24 px / 32 px / 600.
- Initial P1: consecutive empty BlockNote leaf paragraphs rendered as full paragraphs and accumulated into large blank areas. Fix: the published-reader conversion omits empty and whitespace-only leaf paragraphs while leaving the saved editor document unchanged. The browser fixture stores three consecutive empty paragraphs and verifies that only the three authored paragraphs render, with a normal paragraph gap.
- Regression caught after the first typography pass: a broad CSS reset removed authored text colors, highlights, and native bold weight. Fix: removed the reset, restored BlockNote's approved inline formatting, and added a browser assertion for the authored red and bold fixture.
- Current P1: the JUYU shell inherited the application's 15 px base and 1.65 line-height, while the official page uses 16 px and 1.5. Fix: scoped the official values to `.juyu-fumadocs`, preserving the rest of the application.
- Current P1: stored level-two and level-three BlockNote headings rendered one visual level too small. Fix: mapped their semantic output to the official 24 px h2 and 20 px h3 values with the official margins.
- Initial P2: Markdown and PDF were exposed as separate custom buttons. Fix: they now live in the official-style `Open` popover beside `Copy Markdown`.

## Follow-up polish

- P3: verify the exact authenticated production article after deployment because this visual evidence uses the controlled local fixture. Articles without authored descriptions will continue to omit the description line by design.

final result: passed

# Q&A editorial knowledge index design QA

- Source visual truth: `/Users/tony/.codex/generated_images/01a07e8f-7d3d-7913-ae5a-b945e4845a98/exec-46e8bece-965c-4ca6-a793-47636ded8b42.png`
- Desktop implementation: `/Users/tony/Documents/ChatGPT/Juyu V2/output/verification/qa-editorial-desktop.png`
- Mobile implementation: `/Users/tony/Documents/ChatGPT/Juyu V2/output/verification/qa-editorial-mobile.png`
- Desktop state: light theme, 1440 x 1000 CSS viewport, four published Q&A fixtures.
- Mobile state: light theme, 390 px CSS viewport, full-page capture.

## Full-view comparison evidence

The selected fourth concept and implementation share the same editorial structure: a large serif Q&A heading, restrained red accent, horizontal category index, numbered question directory, and one focused answer panel. Rounded answer cards and repeated expanded answers are absent. The production page keeps the official Fumadocs navigation shell and uses its documented `DocsPage full` layout rather than replacing the reader frame.

## Required fidelity surfaces

- Typography: the page title and selected answer use the reference's editorial serif hierarchy; interface labels remain in the product sans-serif stack.
- Layout: desktop uses a compact numbered index beside one wide answer. Mobile stacks the same index above the answer without horizontal overflow.
- Color: JUYU red marks the active category, selected question, labels, and actions in light and dark theme tokens.
- Interaction: selecting a numbered question changes the single answer panel and updates the canonical `question` URL and hash. Search, categories, related topics, independent links, edit permission, answer caching, and access checks remain intact.
- Fumadocs boundary: the official sidebar, search trigger, theme switch, account footer, `DocsLayout`, `DocsPage`, `DocsTitle`, `DocsDescription`, and `DocsBody` remain in use.

## Findings and fixes

- Initial visual review found the default docs width too narrow for the selected two-column index. Fix: enabled Fumadocs' official `full` page option.
- Initial visual review found the search action using a foreground token that disappeared on the light background. Fix: mapped the action and selected states to the existing JUYU red accent.
- The mobile capture contains the Next.js development toolbar badge; it is development-only and is not included in a production build.
- No actionable P0, P1, or P2 mismatch remains in this scope.

## Verification

- Complete type, lint, 506-unit-test, and production-build command passed.
- 216 critical browser checks passed across desktop and mobile.
- Dedicated Q&A checks confirm numbered selection, one answer panel, safe title rendering, filters, pagination, error states, permissions, caching, and no horizontal overflow.

final result: passed

# Help Centre editorial home design QA

- Source visual truth: `/var/folders/by/2103qtln3xd6rsg6nfxqt3yw0000gn/T/codex-clipboard-a42ff925-aee2-4356-baa3-3f894a481360.png`
- Desktop implementation: `/Users/tony/Documents/ChatGPT/Juyu V2/output/verification/fumadocs-home-desktop-light.png`
- Mobile implementation: `/Users/tony/Documents/ChatGPT/Juyu V2/output/verification/fumadocs-home-mobile-light.png`
- Desktop state: light theme, 1440 x 1000 CSS viewport, Help Centre home fixture.
- Source state: light theme, 1488 x 1058 screenshot.

## Full-view comparison evidence

The selected reference and implementation both use a restrained editorial home: serif JUYU masthead, left-aligned large question, red answer emphasis, one full-width search trigger, horizontal content-type navigation, a pale featured article, numbered article rows, and a separated right column for recent updates and recent reading. Existing article titles, descriptions, routes, permissions, updates, and recent-history data remain live rather than becoming decorative mock data.

## Required fidelity surfaces

- Typography: serif editorial hierarchy and large desktop title preserved, with a responsive mobile scale.
- Color: JUYU red is explicit for the masthead, answer word, active section, links, and update markers; light and dark themes retain readable body text.
- Layout: desktop keeps the reference's main/right column split; mobile stacks the same sections and makes the type navigation horizontally scrollable.
- Search: the visible trigger and dialog remain the official Fumadocs search surface, including type filters, multi-result previews, snippets, and keyboard access.
- Dynamic states: failed optional announcement loading no longer inserts a large error panel above the home design; real available announcements still render.

## Verification

- Structural reader-boundary suite: 5 passed.
- Targeted homepage browser suite: 2 passed across desktop and mobile.
- The browser suite checks official Fumadocs search behavior, every content-type route, red title accent, dark-mode contrast, and horizontal overflow.

## Findings

No actionable P0, P1, or P2 mismatch remains within the selected homepage concept. Production deployment still needs to run before the public URL can display this local implementation.

final result: passed
