# Home content navigation scrollbar repair — 2026-10-09

## Cause and change

The active content-type underline extended 1 px below its link. The horizontal
scroll container computed vertical overflow as `auto`, so its 58 px content area
had 59 px of scrollable content. Persistent scrollbars exposed the unwanted
vertical bar; overlay scrollbars could conceal it.

Move the full 2 px underline inside the link and explicitly hide vertical
overflow on this navigation container. Keep horizontal overflow enabled and
preserve the existing typography, colors, spacing, links and breakpoints.

## Verification

- Before the repair, both desktop regression cases failed: 1 px vertical overflow.
- After the repair, 6 focused browser cases passed: native and simulated 12 px
  persistent scrollbars, desktop/mobile and existing home behavior.
- At 390 px and 320 px, the document does not overflow horizontally; the tab
  strip can still scroll to its last link. Desktop keyboard navigation still
  reveals the focused last link.
- The in-app browser rendered the actual local home component with
  `clientHeight === scrollHeight === 58` and the underline inside the container.
- `npm run verify:build` passed: typecheck, lint, 575 unit tests, production build
  and postbuild asset/style checks.

Focused regression command (development fixtures are intentionally unavailable
in production and are not part of `test:critical`):

```sh
E2E_DEV=1 npx playwright test tests/e2e/fumadocs-preview.spec.ts --grep 'home content tabs|Help Centre home retains'
```

Persistent scrollbars were simulated in Chromium. The three reported computers
have not been checked after deployment. This record describes local verification;
it does not assert a GitHub push or production deployment.
