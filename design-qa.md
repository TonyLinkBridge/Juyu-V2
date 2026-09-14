# GitBook reading-layout comparison — 2026-09-14

final result: passed

Scope: the agreed reading-page layout adaptation, retaining JUYU branding, authenticated account actions, existing article content, the two-value feedback model and private PDF/favorite functions. This is not a claim that every GitBook product feature or arbitrary article body is duplicated.

## Reference and capture

- Source: https://tony-14.gitbook.io/help-center/getting-started/getting-started-checklist
- Source code: /Users/tony/Downloads/gitbook-main/packages/gitbook/src/components/ (TableOfContents, Header, PageAside, PageBody).
- Implementation: http://127.0.0.1:3212/design-preview/article-email
- Both pages were opened and captured together at 1710 × 983 CSS pixels, light theme, collapsed and expanded category states. The source uses English onboarding content; JUYU uses the existing Chinese email article and nested categories. Content-specific line breaks, topic counts and block types were not treated as geometry mismatches.
- JUYU has a 30.148px development-only preview notice above its header. Measurements below subtract this notice from vertical comparisons.
- Mobile inspection at 390 × 844, plus desktop dark theme. The mobile feedback control was clicked in the in-app browser, and its comment field received focus without being covered.

## Iteration and fixes

1. Removed the old full-width reader/grey sidebar/right-rail card overrides in product-shell.css. Added a scoped reader stylesheet grounded in the reference grid.
2. Reference and implementation now both have sidebar x=167, w=288; main x=503, w=768; rail x=1287, w=256; header h=64; search x=503, at 1710px viewport width.
3. The source home and group rows are x=155, w=292, y=96 and 144. Final JUYU rows are x=155, w=292, y=126.148 and 174.148 including the local notice, matching the reference after subtracting it.
4. Restored compact icon navigation and removed duplicated article title in the breadcrumb. Category icons use JUYU topic semantics; this does not add a persisted custom-icon management feature.
5. Kept account, theme, admin and exit access in the account menu. The desktop preview menu was opened and its theme/admin controls inspected. Real sign-out was not executed.
6. Reduced feedback and utility chrome while preserving accessible labels, feedback submission semantics, errors, and version information. The right rail contains an outline where the actual article has headings; the reference checklist has no equivalent outline.
7. Removed desktop sticky positioning when the rail uses the mobile flow. Fixed the test fixture's missing mobile search wrapper, which had caused overflow and misleading pointer interception.
8. Scoped the new CSS strongly enough to resist the old rules even when built stylesheet chunks are consumed in a different order.
9. Local sample favorites now use a clearly labeled, isolated preview state. Sample feedback has an initial empty snapshot, avoiding a read against a nonexistent production article.

## Verification

- Production build, TypeScript and built-style/browser asset checks passed.
- Eight desktop/mobile layout and navigation checks passed; after the final 8px adjustment, both layout checks and twelve feedback checks passed again (14/14).
- Long-title wrapping, collapsed/expanded keyboard navigation, exact selected article, history navigation, dark text readability, mobile overflow and feedback focus were exercised.
- Screenshots: output/verification/gitbook-layout-{light,dark,collapsed}-{desktop,mobile}.png (local test fixture); actual reference and implementation captures are in this task's browser tool results.
- Live production deployment, authenticated multi-role acceptance and real-device testing are not claimed by this local visual change. Nothing was pushed or deployed in this turn.

## 2026-09-14 push preparation

- The live article body contained bold paragraphs instead of headings. Three headings were saved through the production editor and submitted to haley@juyu.com for review; publication remains pending.
- Editor code now explains missing headings inline and previews the outline using the same parsed sections as the reader.
- Removed the inherited full-viewport minimum height from the new right rail to prevent a sticky-position regression.
- This record does not establish production acceptance of the unpushed visual changes.
