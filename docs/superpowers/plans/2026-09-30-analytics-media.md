# Analytics and Media Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans in this session; no delegation.

**Goal:** Make both selected admin layouts useful with authentic data and existing JUYU visual style.
**Architecture:** Existing authorization/scoped transactions remain gates. Add a separate monotonic visible-time table and authenticated paginated people endpoint. Media queries existing assets/revision links and uses existing upload/delivery.
**Tech Stack:** Next.js 16.3.4, React 19, PostgreSQL, current CSS tokens and Phosphor icons, Node 24.19.0.
**Spec:** docs/superpowers/specs/2026-09-30-analytics-media.md

## Global Constraints
- Preserve AdminFrame, existing logo/fonts/tokens; no production mock data.
- Duration is visible time only; past opens cannot gain fabricated duration.
- Only verified admins can read employee details/files; no new public access.
- Preserve previous migrations and legacy media editor; migration 0055 adds duration.

## Review Focus
- Hidden/unloaded tabs and duplicated retry reports must not inflate duration or views.
- Cross-employee reports and archived/hidden documents must fail closed.
- Filename wildcards, duplicate names and page bounds must remain stable.
- Upload must not detach files from articles or allow in-review edits.
- Mobile/dark detail panels, empty/error states and keyboard buttons must remain usable.

### Task 1: Visible time and analytics data
Files: analytics/model.ts, analytics/visible-time.ts, ArticleAnalytics.tsx, migration 0055, server analytics dashboard/people repository, service and people route.
Interfaces: usage summary/trend/article counts; PeoplePage {items,total,page,pages}; view_time report {eventId,viewId,documentId,revision,visibleMs}.
- [x] Write/run failing input, visibility timer and DB owner/retry/range tests.
- [x] Implement timing, owner-checked monotonic capture, dashboard extension and paginated people query.
- [x] Run analytics unit and DB suites; preserve current summary/count meanings.

### Task 2: Asset library and upload targets
Files: media/library.ts, server/media/library.ts, service, media library/targets API.
Interfaces: MediaLibraryData {items,total,page,pages,counts,selected}; validated query and upload-target pagination.
- [x] Write/run failing query/search/relationship/access tests.
- [x] Implement parameterized read-only file query and authorized upload targets.
- [x] Run media unit and isolated DB suites.

### Task 3: Unified interfaces
Files: AnalyticsDashboard, AnalyticsPeople, MediaLibrary, MediaUpload, admin media page, scoped CSS.
Consumes: Task 1 usage/PeoplePage and Task 2 library/targets, existing upload/delivery.
- [x] Add interaction checks for selection, tabs, filtering, upload state, error/empty states.
- [x] Build selected structure in current red/gray tokens, retain original shell and legacy URLs.
- [x] Verify real components in internal browser at desktop/mobile/light/dark; save [design-qa.md](../../design/design-qa.md).
- [x] Run full unit suite, targeted DB checks, typecheck/lint/build and diff check.
