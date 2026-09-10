# T051 导航设置 · 2026-09-10

## Binding scope
Admin 配置现有页面与分类入口、排序及角色可见性；菜单隐藏不替代接口授权。普通员工不能读原始配置或写配置。Support 不可读 OPS，Ops/Admin 可读 OPS；分类现行父级继承/正式版本权限继续独立执行。旧正式版可读，草稿不出现在入口及分类页面。

## Design and contracts
- 可配置的员工快捷入口，与 GitBook 文章树分开。保留固定品牌首页、退出和仅Admin后台入口，不允许把人锁出系统。
- 现有页面枚举 home,ops,reference,qa,favorites,recent,forms；分类目标使用稳定UUID。禁止任意URL或程序。单个完整配置最多40项，数组顺序就是展示顺序，禁用项保留；角色可选择 support/ops/admin，显示还须满足目标当前权限。
- src/navigation-settings/model.ts exports NavigationEntry {id,label,enabled,roles,target}; target {type:'page',page} | {type:'category',categoryId}; NavigationConfig {version,entries}; NavigationWrite {expectedVersion,entries}; MenuItem {id,label,href}. Version 0 gives documented built-in default entries only if no persisted setting exists. Strict keys, bounded labels, lowercase UUID, unique entries, canonical roles. Page enum and defaults exported. Exact retry requires same actor, expectedVersion and config; concurrent differing changes conflict.
- Admin GET/PUT /api/admin/navigation returns {config:NavigationConfig}; reader GET /api/reader-menu returns {items:MenuItem[]}. Admin page /admin/settings/navigation. Category landing /help-centre/categories/[id] uses existing authorized publication tree to list current published documents recursively; absent/denied category yields generic unavailable/not-found with no private metadata. Hiding an entry never denies direct authorized destination access.
- Backend exports repository readNavigationSettings(c), writeNavigationSettings(c,input), readReaderMenu(c). AuthorizationService navigationSettings(), saveNavigationSettings(input), readerMenu(). Database migration0023 only, no old migration mutation. Use generic settings and setting_versions immutable audit if practical.
- Settings UI full-config edit; add/rename/reorder/role toggles/enable-disable/remove shortcut only (no content deletion). Current version, exact retry, conflict reload with retained input backups, unsaved input guards and honest unconfigured state; current category selector from existing admin categories API. Explain hiding vs access control.
- Reader menu pure component receives only server filtered MenuItem[], plus reusable server wrapper; fully responsive, keyboard accessible. Add via EntryShell navigation slot after header to all authenticated reader pages; never hard-code secondary duplicate configurable links in main reader actions. Existing essential controls stay.

## Execution
1. Backend agent owns model/repository/http/API/service/migration, unit and database tests. Scope all authorization surfaces and exact retries.
2. UI agent owns navigation settings client/component/CSS/admin page/workspace link, isolated browser fixture/spec. May read backend model; coordinate contracts before deviations.
3. Root owns reader menu/components/EntryShell/page integration/category landing, associated tests, docs/source manifests, build and whole regression.
4. Independent reviewer reviews complete diff against immutable stage baseline; implementers address findings; root verification then record local acceptance.

## Validation
Baseline291unit/337DB/522browser,22migrations. Focused failures before implementation; then full unit/real temporary PostgreSQL/build/type/lint/desktop-mobile browser. No build during browser run. Check real unconfigured APIs and page redirects. View desktop/mobile screenshots. Persist source hashes and evidence.

## Boundaries and rulings
Ruling: use shortcut navigation separate from article tree — hiding menus must not alter read permissions — changing tree behavior later would require a distinct navigation design.
Ruling: fixed targets, max40, whole-config version and explicit role sets — fulfill approved configuration scope without new routing/program features — larger navigation sets would need another validation limit.
Ruling: existing non-Git workspace and existing agent slots reused with new scoped briefs — preserve authorized folder and current changes — reviews use copied baseline diffs instead of Git history.
Real Clerk/Supabase/company allowlists, cloud migration, deployment and physical device acceptance remain unconfigured/unverified. No writes to external services. No memory changes. No standalone new chat tasks.

## Progress
- Baseline captured; plan approved by existing staged authorization.

- Ruling: 分类入口按所有当前正式归属列出文章，普通文章树仍只显示一次 — 防止多分类文章在第二分类入口遗漏 — 分类列表与左侧目录数量可能不同。

## Local completion
- [x] Backend configuration/API/CAS/ACL and real temporary PostgreSQL acceptance.
- [x] Admin editor and isolated desktop/mobile acceptance, exact retry and cumulative backups.
- [x] Reader menu, current-publication category landing and role-independent destination access.
- [x] Independent full-source review and scoped final lint fix review, no unresolved findings.
- [x] Whole unit306/306, DB348/348, browser548/548; final reader8/8; build/type/lint pass.
- [x] Sources, verification record, task state and3211 preview updated; real services remain pending.

CSS compiled artifact mismatch resolved with preserved-cache clean build and browser replay; underlying cache invalidation cause remains unconfirmed. Final screenshot waits for theme transition completion, without product behavior changes. Next stageT052.
