# Theme controls: 2026-10-05 local verification

Base revision: `f8af44bc3cf4ba091e2fa5864b97e93f3e6ba864`.

## Implemented scope

Following the user's latest decision, JUYU disables the Arc account menu's appearance row and keeps theme switching outside the menu. Custom admin and legacy reader headers render the official Fumadocs `ThemeSwitch` component. Full Fumadocs layouts keep their existing native controls; account-only adapters do not add a duplicate. All controls share the existing root theme provider. Login and error-page footer controls are unchanged.

Removed old mobile rules that hid the external theme control. Account settings, role presentation and guarded sign-out behavior are unchanged.

## Verification

Using Node 24.19.0:

- `npm run verify:build`: typecheck passed, lint had no errors, 569 unit tests passed, production build passed, built CSS and browser/font tracing checks passed (4 routes). One existing lint warning remains in `tests/helpers/fixture-typescript-loader.mjs`.
- Account menu, reader frame and foundation browser suites: 68 tests passed across desktop and mobile. Coverage includes native theme changes and reload persistence, absence of the menu appearance row, external theme visibility, keyboard/focus behavior, sign-out failure recovery and mobile search/overflow at 320, 390 and 760 pixels.
- `git diff --check`: passed.

The in-app browser was checked at desktop 1280 x 720 and mobile 390 x 844. The menu has no appearance row, the external native control is visible, and there is no horizontal overflow. The browser viewport was restored afterward.

Screenshots are saved under the ignored `output/verification/theme-entry-2026-10-05/` directory (`desktop.png`, `mobile.png`).

The local fixture uses the actual application components and built CSS, with example identities and stubbed external Clerk/router boundaries. These results do not establish real-account or production acceptance. This change has not been pushed or deployed; it requires no database migration.
