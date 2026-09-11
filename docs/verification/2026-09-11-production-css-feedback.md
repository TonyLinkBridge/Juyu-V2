# Production CSS recovery and admin feedback
## Production recovery (performed)
Current source commit: 106fc2d.
Faulty deployment: 3Rxxyu2mdis41bLCCH52adgqFtTc. Its CSS 0r6ppzux7idzo.css lacked editor-focused, editor-toolbar and native-document selectors even after a full page reload; DOM contained editor-focused/admin-frame is-editor.
Redeployed the same source without existing Build Cache. Deployment GEqdEL5njzhTh9BNBnX9qpByzp12 reached Ready and serves 2qk0m_ruf7agr.css.
Live /admin/editor verified: toolbar display flex, sidebar display none; focused editor visually restored. No production article or database content was created/changed.

## Local changes (not deployed)
- Disable Turbopack build filesystem cache; preserve normal dev caching.
- Postbuild guard fails if compiled CSS lacks focused editor, native reader or feedback selectors.
- Remove unused workspace feature-flags request.
- Combine enrollment context reads (4 queries to 1) and member availability reads (3 to 1, checked twice during bind). Existing role, disabled, pending and lock behavior retained.
- Pending indicator on admin links; no speculative prefetch or shared permission cache.
- Custom accessible dialog for editor leave/reload/server-copy recovery. Native beforeunload remains browser-controlled.
- Success/error toast for editor operation notices and save errors; important inline recovery remains visible. Success timeout pauses on focus/hover; error is dismissible without timeout.
- Existing lifecycle/publication confirmation panels receive consistent styling. Other settings pages' native confirms are not globally replaced.

## Validation
351 unit tests; 385 isolated database tests passed. Production build, lint, TypeScript and compiled CSS guard passed.
In-app browser with isolated editor: intentional save failure exposed dismissible error notification; leave dialog defaults to Cancel, Escape closes and title stays unchanged.
Screenshots: output/verification/feedback/confirm.png and toast.png.
No before/after production latency claim: SQL reductions are verified by code and DB tests; new optimization must be deployed and timed before claiming a speed improvement.
