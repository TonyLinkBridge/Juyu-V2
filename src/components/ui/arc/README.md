# UIArc components in JUYU

Official registry TSX and CSS Modules, retrieved 2026-10-08. Registry URLs and SHA-256 receipts are in [sources.json](sources.json); copyright and MIT notice are retained in [LICENSE](LICENSE). No extra dependency was installed.

| Component | Production integration | Local adaptations |
| --- | --- | --- |
| File Dropzone | Media upload dialog | Chinese labels; explicit-submit staging, disabled controls, external upload status/progress, safe retry callback |
| Action Button | Media upload and category save | Chinese labels supplied by caller; synchronous duplicate-click guard; success only after acknowledged action; optional live announcement when the host form already has its own status; JUYU action color tokens |
| Filter Toolbar | Media library | Chinese labels; URL-backed filter add/remove/clear |
| Multi-select | Article category assignment | Chinese label defaults; full hierarchy paths and effective-access hints from existing category model; max 20; menu flips upward and scrolls within a short drawer |
| Sortable Data Table | Media list | Chinese labels; controlled manual server sorting before pagination; current detail-row highlight |
| Date Range Picker | Analytics | Chinese labels and locale; calendar bounds validated on server and shared with employee detail |

`ArcScope` maps official component tokens to existing JUYU colors, radii and fonts. The existing reader and editor frameworks remain unchanged. Recent 7/30/90 day links keep their rolling-window semantics; newly selected calendar ranges include both selected dates in UTC+8 (end bound is exclusive next midnight).

Uploads use the existing private upload endpoint. Transfer progress stays below 100% until a `ready` receipt is returned. Unknown network/server outcomes do not offer a retry that could duplicate an upload. No new API key, permission, database table, or migration is needed.
