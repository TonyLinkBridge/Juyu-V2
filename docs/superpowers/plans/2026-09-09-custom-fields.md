# T048 自定义字段 Implementation Plan

> Use superpowers:subagent-driven-development for independent backend implementation and focused review. User has approved staged TASKS execution; next-step authorization continues T048. No git exists; use /private/tmp/juyu-t048/baseline, never create/delete this project as a worktree.

**Goal:** Admin defines versioned fields; editor validates and stores their snapshots with immutable article revisions; disabled values and historical versions survive.
**Architecture:** Existing settings/setting_versions; new revisions.custom_fields JSONB; shared strict model; admin-only settings GET/PUT; current definitions fetched server-side for existing/new editor. No new packages/cloud actions.
**Spec:** TASKS.md T048 and accepted conversation requirements.

## Decisions
- Types: text, number, date, select, boolean. Maximum 30 settings total, names 1–80 trimmed codepoints, text value max2000, select 1–30 distinct nonblank options <=80, finite numbers, real YYYY-MM-DD dates, boolean false is a valid required answer; null represents absent. Fields are article metadata for all content kinds, inherit article visibility and approval.
- FieldDefinition {id:UUID,version:positive integer,enabled:boolean,name:string,type:FieldType,required:boolean,options:string[]}. FieldSnapshot same plus value:string|number|boolean|null (enabled captured at save). Values/labels/definition version belong to revision; settings edits never rewrite formal or historical articles.
- FieldWrite {expectedVersion:number|null,name,type,required,options,enabled}. UUID stable caller ID; setting key derived field-UUID. Type immutable after creation. No destructive delete; disable/re-enable. Changes create immutable setting_versions. Optimistic exact retry; stale change fails; max count serialized.
- Normal saves require latest definitions and exact enabled field set. Inactive existing field snapshots must be preserved unchanged. Client cannot invent metadata or remove disabled values. Unknown/stale fields fail. Existing source revision may be restored to new draft exactly, with current definitions reconciled on later edit; published copy remains untouched.
- Shared exports src/fields/model.ts: FieldDefinition, FieldSnapshot, FieldWrite, FieldType; parseFieldWrite(unknown), normalizeFieldSnapshots(unknown), prepareFieldSnapshots(definitions,saved=[]), validateFieldSnapshots(definitions,snapshots,previous=[]). Normalization validates structural bounds; full required/options check only in validator so old history remains representable.
- EditorData optional fieldDefinitions/customFields for backwards-compatible local fixtures. SaveDraftInput optional customFields. Actual server always supplies definitions; new editor receives definitions as separate prop. Root owns UI/client and route integration. Backend owns domain/persistence/contracts and history/read/PDF server projections.
- Reader/review/history/PDF display saved snapshots using one shared value-list component/HTML helper; values never added to unauthenticated route. No independent field permissions or search indexing in T048.

## Tasks
- [x] Backend: model tests red; strict config+snapshot model; migration settings write protection, current identity, revision column, history restore; repository save/current definition concurrency; actual DB permissions/history/publish/disabled/retry tests; full DB regression.
- [x] Frontend: Admin field settings listing/edit/create/enable form; shared field inputs and value list; new/existing article integration, autosave/ack/recovery; admin settings route/API/service; permission checks.
- [x] Verify: unit, build/type/lint, focused browser including mobile/empty/errors/retries/typed values; relevant wider regression; independent review and fixes.
- [x] Record sources, TASKS local/real boundaries, preview refresh. Next T049 categories.

## Rulings ledger
- User already authorized fields, forms and navigation settings and staged implementation. Routine type/limits/storage decisions proceed without new approval.
- No cloud credentials available; all success-path data is local test fixture or temporary PostgreSQL. Actual authenticated cloud acceptance remains pending.

- Review fixes: database direct INSERT semantic guard added; frozen editor and preview now render acknowledged snapshots. Reproduced old-value bug before fix; focused22 browser,313DB and257unit pass. Full browser regression in progress.

- Completion: final257unit/313DB/470browser/1actualPDF pass; build/type/lint and37filehashverification pass. Localpreviewrefreshed. No realcloudacceptance. T048 locally accepted, T049 next.
