# 核心权限与审核版本 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 完成 T004–T006 的可执行领域规则，为后续前后台共用授权和版本流程提供基础。

**Architecture:** 在独立 V2 目录以 TypeScript 纯函数表达可信服务端身份、阅读授权和审核状态转换。每次操作返回新的文档状态和历史，数据库接入时必须在事务内检查 sequence 并持久化。UI 和客户端请求不能直接构造可信身份。

**Tech Stack:** TypeScript，Node 原生测试；此阶段无需外部账号或运行时依赖。

**Spec:** `docs/design/review-workbench.md`、`docs/design/employee-reader.md`、`TASKS.md`。

## Global Constraints

- 仅 support / ops / admin；未验证公司身份或未知角色一律拒绝。
- 草稿、等待审核、需要修改、已经批准、等待发布、已经发布，共六状态。
- 指定另一位 Admin 二审；不能批准自己的提交或自己编辑的当前版本。
- 员工阅读始终取正式发布指针；新稿不改变旧正式版。
- 已批准内容再次编辑创建新版本，批准失效；待审内容需先撤回。
- 正文、检索投影和附件版本共用阅读授权；本阶段不是实际搜索/文件接口。
- 不修改用户提供的三个源目录；不读取或复制 `.env` 和密钥。
- 无真实身份服务、数据库事务或页面验收时，不声称相应任务完成。

## 文件与接口

- `package.json`：Node 测试脚本和版本要求。
- `src/domain/model.ts`：`Viewer`、`Revision`、`Document`、`Workflow`、`AuditEntry` 类型。
- `src/domain/access.ts`：`parseRole(value)`、`canManage(viewer)`、`readPublished(viewer, document)`、`canReadAsset(viewer, document, asset)`、`searchProjection(viewer, documents)`。
- `src/domain/workflow.ts`：`createDocument(input, actor, now)` 与 `transition(document, command, actor, context)`。
- `tests/access.test.ts`、`tests/workflow.test.ts`：行为验收。
- `README.md`：运行方法与实际实现边界。

`Viewer` 来自后续可信服务端解析：`{ id, role, companyVerified }`。`Document.sequence` 是持久化乐观锁；`publishedRevisionId` 与 `workflow.revisionId` 分离。`Revision` 记录 `id/title/body/audience/authorId/editorId/createdAt`；`body` 暂用字符串表示版本快照，编辑器接入时替换为经验证的结构化文档。

`transition` 参数 `context` 为 `{ expectedSequence, now, reviewer? }`，`reviewer` 必须由服务器查询。命令为 `edit`、`submit`、`withdraw`、`reassign`、`reject`、`approve`、`queue`、`publish`。所有命令检查 Admin 身份、状态与乐观锁。调用者不能传入任意目标状态。

## Task 1 · 工程与访问规则（T004、T005）

- [x] 创建测试入口 `node --experimental-strip-types --test tests/*.test.ts`，不引入数据库或浏览器依赖。
- [x] 定义上述模型和访问函数签名；访问函数最初全部拒绝，先验证允许读取的测试失败。
- [x] 写角色矩阵：Support 对 staff=true、ops=false；Ops 对 staff/ops=true；Admin 对 staff/ops/admin=true；未知角色、未验证身份、空用户、无正式版、归档和回收站=false。

核心验收例：

```ts
assert.equal(readPublished(support, opsDocument), null);
assert.equal(readPublished(ops, opsDocument)?.title, '运营正式版');
assert.equal(readPublished(support, documentWithNewDraft)?.body, '旧正式内容');
assert.equal(canReadAsset(support, documentWithNewDraft, {
  documentId: 'doc-1', revisionId: 2,
}), false);
```

- [x] 实现授权：只返回当前正式版本，使用该版本自身 audience；搜索投影不包含任何工作流/草稿；附件必须同时匹配资料 ID 和正式版本 ID。
- [x] 运行访问测试，确认矩阵和草稿隔离全部通过。

## Task 2 · 审核状态机（T006）

- [x] 为状态机写真实行为测试：创建草稿；A 提交给 B；A/C 不可批准；B 退回必须给原因；B 批准后可安排发布；缺批准不能发布；非 Admin 不能执行任何操作。
- [x] 增加版本验收：已发布版编辑后仍可读旧正文；改动不复用已批准版本；等待审核时编辑失败；撤回后可编辑；失效 sequence 被拒绝且原对象未改变。

完整链路例（测试固定时间，身份为手写测试夹具）：

```ts
let doc = createDocument({ id: 'doc-1', title: '说明', body: '旧正式内容', audience: 'staff', kind: 'article' }, adminA, now);
doc = transition(doc, { type: 'submit' }, adminA, { expectedSequence: 0, now, reviewer: adminB });
assert.throws(() => transition(doc, { type: 'approve' }, adminA, { expectedSequence: 1, now }));
doc = transition(doc, { type: 'approve' }, adminB, { expectedSequence: 1, now });
doc = transition(doc, { type: 'queue' }, adminA, { expectedSequence: 2, now });
doc = transition(doc, { type: 'publish' }, adminA, { expectedSequence: 3, now });
doc = transition(doc, { type: 'edit', title: '说明', body: '新草稿', audience: 'staff' }, adminA, { expectedSequence: 4, now });
assert.equal(readPublished(support, doc)?.body, '旧正式内容');
assert.equal(doc.workflow.status, 'draft');
```

- [x] 先运行测试记录失败，再实现状态转换。每次返回独立拷贝，递增 sequence；审核者、提交者和版本绑定；发布只切换到当前已批准版本。
- [x] 增加重分配审核人验证：旧二审不能继续批准；新二审能批准；拒绝给作者、提交者、编辑者或非管理员。
- [x] 校验审计输出：记录操作者、时间、动作、版本、二审人/原因；任何失败不修改原状态。
- [x] 运行完整测试，检查代码与产品要求一致，更新任务状态和 README 的边界。

## 后续接入约束

这里的 sequence 校验只能发现调用时传入的旧状态，不能独自解决数据库并发。T008 必须用事务条件更新避免两个请求同时通过。这里的身份夹具不是 Clerk；T012–T016 必须从服务端验证身份、校验邮箱和 Slack，再构造 Viewer。这里的附件判断不是存储策略，T010–T011 必须落实到实际接口、私有桶与缓存。
