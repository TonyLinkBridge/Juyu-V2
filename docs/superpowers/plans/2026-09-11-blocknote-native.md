# BlockNote native experience implementation plan

Goal: restore the installed 0.54.0 default editor, with private JUYU files and existing review workflow.
Architecture: default BlockNote schema/UI plus existing JUYU extension blocks; server validation accepts the same native structures; reader, PDF and search preserve all display text and asset authorization. Old V1 snapshots remain readable. No real-time collaboration service or AI subscription is implied by default-editor parity.
User authorization: user explicitly requested complete BlockNote experience following the audit and end-to-end recommendation. Execute in this task without subagents.

- [x] Add failing native document roundtrip, unsafe input and PDF tests.
- [x] Support native blocks, links, colors, table structure, private file references and old documents in validation.
- [x] Restore default editor toolbar, side menu, slash menu, paste, native tables/files/code and upload callbacks. Keep additional JUYU blocks.
- [x] Render all native content in reader/history/review/PDF, preserve heading anchors and private asset paths.
- [x] Update search extraction and audio upload database migration, verify using isolated database tests.
- [x] Verify native interactions and save/reopen in browser tests; compare default component behavior, light/dark and mobile layout.
- [x] Run scoped tests, typecheck, lint and production build. Document exact remaining production steps rather than claim deployment.

Acceptance: all 14 default block types survive save/reopen; safe links and colors, six heading levels, nested/toggle/check lists, table cell spans/widths/formatting, file upload/resize/rename/caption and rich paste work. Private media retain authorization through revision asset projection. No unrelated authentication changes. Existing custom hint/tabs/math/diagram and old documents remain usable. PDF expands collapsed contents; playable media are represented as attachments in print.
