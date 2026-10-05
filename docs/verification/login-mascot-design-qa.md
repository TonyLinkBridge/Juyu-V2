# JUYU mascot login: local implementation verification

Date: 2026-10-05. Scope: the approved employee/admin mascot login design, integrated into the existing Next.js login routes.

Local implementation result: passed. Production deployment and real-account Slack acceptance are not recorded by this report.

## Design and implementation

- Approved visual source: the interactive mascot preview at `http://127.0.0.1:8780/#employee` and `#admin`.
- Actual source preview: `http://127.0.0.1:8782/design-preview/login-light` (employee) and `login-dark` (admin). These existing development-only routes share `LoginScreen` with the real login routes; they do not create sessions.
- Employee wording: **JUYU KNOWLEDGE BASE**. The employee entrance uses the astronaut; the admin entrance uses the circular mascot. Existing JUYU logo assets are reused.
- Keep the approved centered login composition, small mascot, subdued starfield, red provider button, email disclosure, access note and footer. Use the existing official Fumadocs theme switch, including its system option; both entrances follow the shared theme.
- Desktop comparison: approved and integrated views at 1280 × 800. Mobile review: 390 × 844 and 320 × 740. The mascot remains separate from the form; the document has no horizontal overflow at either phone width.
- Images are compressed transparent WebP assets, 640px wide: employee 124,674 bytes, admin 106,152 bytes. Their displayed desktop widths remain 232px and 248px, with a 130px mobile composition.
- Retain the supplied starfield behavior and subtle mascot movement; reduced motion disables movement, and the canvas pauses while the document is hidden. Responsive styles are scoped to the login screen, following the approved preview's breakpoints.
- Existing login styles are removed from `product-shell.css` and consolidated in `login.css`, avoiding competing legacy overrides.

## Behavior and verification

- Production authentication still uses Clerk's actual `SignIn`, with registration disabled and fixed employee/admin redirects. No demo authentication handler is added to production.
- Existing service-loading, service-failure and continuation states remain visible. Existing error-page retry and configured-session logout recovery are retained.
- In-app browser: inspect employee/admin designs, dark/light themes, email disclosure, 390px and 320px layouts; follow the help link to the real error page and its retry link to the real `/sign-in` route.
- 569 unit tests pass, including session, access, login redirect sanitization and logout-recovery tests.
- 10 targeted browser regressions pass: both entrances on desktop/mobile, email disclosure, fixed redirects, error states, theme updates and keyboard navigation. Two additional login accessibility tests pass in both themes. The browser fixture stubs the external Clerk service, while rendering the actual login components.
- Correct the existing mobile fixture's missing viewport metadata and update the older keyboard expectation to the actual login skip link/recovery link.
- Final production build and its built-style/browser-tracing checks pass. Type checking passes; lint has no errors and one existing warning in `tests/helpers/fixture-typescript-loader.mjs`.
- The installed Chrome executable was used through a temporary Playwright config because this workstation lacks the current Playwright headless-shell download. No package, lockfile or committed browser configuration is changed.

## Evidence and limits

- In-app browser screenshots: `/Users/tony/.codex/visualizations/2026/09/08/01a07e8f-7d3d-7913-ae5a-b945e4845a98/juyu-login-integrated/`.
- Local code/test logs: `/private/tmp/juyu-login-{build,lint,e2e,accessibility}-final.log`.
- The local project has no Clerk login credentials configured. The actual route truthfully shows the unavailable-service state; the design preview shows the intended logged-out layout. Real Slack/email login, production provider markup and the deployed revision still require post-push acceptance. No authentication configuration or company access rules are changed.
- No GitHub push or deployment is performed by this implementation step.
