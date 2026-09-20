# GitBook batch reader and release gate · 2026-09-20

Branch `codex/gitbook-parity-20260920` remains separate from `main`. Production database migrations 0031–0040 were already applied and checked in `2026-09-20-gitbook-schema.md`; the web application has not yet been deployed from this branch.

- `npm run verify:build` with Node 24.19.0: typecheck, lint, 450 unit tests and production build passed. The generated, gitignored `output/` backup script must be excluded from TypeScript source discovery; this was reproduced as a build failure before the `tsconfig.json` fix.
- `npm run test:db`: 410 passed, 0 failed.
- `npm run test:critical`: 188 desktop/mobile tests passed, 0 failed. The Reference fixture initially failed to bundle new rich-inline imports; after adding its dependencies, all 12 Reference browser cases passed and the complete critical suite passed.
- Reader navigation, reader frame and rich blocks: 90 desktop/mobile tests passed. Old empty-directory, breadcrumb and page-card assertions were updated to the actual reader structure. A regression test first failed for an unfamiliar HTTPS URL pasted into the editor; after the fix, supported providers and the safe link-card fallback both saved successfully.

These browser fixtures use local data and unconfigured authentication. They prove rendering and denied-access behavior under those conditions; they do not prove the deployed site with a real Staff, Ops or Admin account. Item 20 still lacks GitBook's broader third-party metadata and integration previews. Item 26 still needs real-account acceptance and fluent English content review. Seven later GitBook comparison items are not implemented. Do not describe this batch as all 33 items complete.
