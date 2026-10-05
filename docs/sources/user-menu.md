# Account menu source

The account menu uses Elia Kuratli's MIT-licensed Arc User Menu component.

- Component page: https://21st.dev/@kuratlielia/components/user-menu
- Author registry: https://raw.githubusercontent.com/kuratlielia/arc-library/main/public/r/user-menu.json
- Foundation registry: https://uiarc.dev/r/arc-foundation.json
- Source snapshot: 2026-10-05
- License: `src/components/ui/user-menu/LICENSE`

Original component, stylesheet and shared motion presets are retained. JUYU adapters supply localized labels, actual Clerk identity and role labels, the existing theme provider, profile settings, and guarded current-session logout. Cancelled or failed actions keep recovery feedback visible. A ResizeObserver recomputes the original placement when an identity or provider notice changes its size; this preserves the anchor and source dimensions rather than introducing a separate layout. Source neutral light/dark tokens are scoped with CSS Modules; source radius, spacing, type sizes, shadows and motion are retained. JUYU provides page colors and the existing system font stack. The source's global focus-ring suppression and unrelated accent/chart token sets are not imported.

Desktop opens an anchored panel; below the source's 640px breakpoint it opens a portalled bottom sheet. Both surfaces share content. Demo billing, presence and shortcut hints are not configured. The source applies `aria-modal` to a `menu` role, which is invalid; this unsupported attribute is removed while retaining the original sheet, focus handling, backdrop and scroll lock. Menu roles are presentation only and do not grant access; existing server authorization remains authoritative.

Original component SHA-256: `077dd8457c238330e82e494af76623879d3393ef1bc7720b6205bcda06688295`
