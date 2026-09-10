# T009 Supporting Data Implementation Plan

执行方式：沿用已批准任务清单，在当前独立 V2 工程中逐项执行（executing-plans）；不另建项目或改旧站。

**Goal:** 为已确认的辅助功能建立有明确关联和拒绝默认访问的数据结构。
**Architecture:** 追加 0002_supporting_data.sql，不改已验收的 0001_core.sql。沿用私有 juyu schema、PostgreSQL 外键、RLS 默认拒绝及显式迁移事务；本次仅表结构，不开放新的接口。
**Tech Stack:** Node 24.19.0、TypeScript、pg、PostgreSQL 17 临时测试。
**Spec:** TASKS.md 的 T009，以及 T011、T044–T054 已批准的功能定义。

## 范围与关系

这是一家公司一套部署，不是多租户 SaaS；不增加虚假的 tenant_id。所有表属于同一部署的公司范围，真实公司成员验证是 T013。若以后共用数据库服务多个公司，必须同时重构核心和辅助表，再做跨租户权限验收。

- categories：UUID 稳定 ID、parent_id 外键、排序、audience、enabled；revision_categories 用 (document_id,revision_id) 关联分类。改名不改 ID；分类停用保留历史。父级不能是自身；完整防循环、移动权限和配置审计由 T049 的受控管理接口实现，在此之前不开放分类写接口。
- assets：UUID、所属 document_id、上传成员、文件名/MIME/大小、固定私有桶标识、对象键、状态；revision_assets 用复合外键保证文件和版本属于同篇资料。此表不创建 Storage 桶、不生成公开链接。文件所属资料及对象身份固定。
- favorites：member_id + document_id 唯一，不冗余保存标题/正文。
- recent_views：member_id + document_id 唯一，具体 revision_id、最后浏览时间；界面上限和读取权限是 T045。
- feedback：member_id + document_id + revision_id 唯一，可修改帮助与否/意见；历史版本反馈不错误归到新正文。
- search_queries、search_results：查询属于具体成员；结果只记资料版本/名次，不存正文摘要。analytics_events 用稳定 UUID 去重，搜索点击必须对应同一员工的一条已记录结果；浏览/反馈事件不允许伪装搜索点击。
- settings、setting_versions：配置按受支持种类保存 JSON 对象；固定 ID、当前版本指针、不可变版本、修改人。完整字段/表单结构校验、冲突和恢复新版本是 T048–T053，当前不执行任意代码。
- notifications、notification_receipts：公告可限定 audience、有效期，目标只能关联已有文章或设置；阅读/关闭状态按成员保存。前端实际过滤和跳转在 T054。

## 文件和执行步骤

- [x] tests/database/supporting.test.ts：先写 14 张表存在的断言，再分别验证改名关联、孤儿引用、附件跨资料、个人记录唯一性、反馈版本、搜索点击归属、配置历史、公告状态、所有新表默认拒绝、旧库升级及重放。
- [x] 运行 `npm run test:db` 观察缺少辅助表导致失败；核心 13 项保持通过。
- [x] src/server/database/migrations/0002_supporting_data.sql：实现上述表、复合外键、检查、索引与 RLS。migrate.ts 注册追加版本。
- [x] tests/database/core.test.ts：迁移计数更新为 2；checksum 故障只改 0001 行，避免污染新增迁移。
- [x] 跑全部数据库测试、既有单元测试、类型检查和 lint。独立代码审查后修正具体问题。由于本轮不改 Next 页面或依赖，不重复 UI 测试和构建。
- [x] docs/verification/2026-09-08-supporting-data.md 记录证据；src/server/database/README.md 描述表和边界；TASKS.md 只在上述通过后完成 T009。

## 测试核心断言

```ts
assert.equal((await pool.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='juyu' AND tablename=ANY($1)", [supportingTables])).rows[0].n, 14);
await assert.rejects(pool.query('INSERT INTO juyu.revision_assets(document_id,revision_id,asset_id) VALUES ($1,1,$2)', [otherDocument.id, assetId]), { code: '23503' });
assert.deepEqual(await migrate(pool), []);
```

数据库升级测试在临时集群加载原始 0001 SQL 和对应校验和，先创建真实领域文章，再执行迁移确认只追加 0002 且原聚合不变。RLS 测试先确认各新表存在测试行，再切到无策略测试角色；避免用空表假装验证过滤成功。

完成证据：`docs/verification/2026-09-08-supporting-data.md`。24 项数据库测试、51 项既有单元、类型检查及 lint 通过；独立审查建议已处理。
