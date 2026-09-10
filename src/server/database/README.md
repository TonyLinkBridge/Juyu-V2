# 数据库 · T008–T010

> 2026-09-10 当前接入说明：[T059 测试环境配置](../../../docs/setup/T059-test-environment.md)。下文保留各阶段历史记录；公司准入、业务授权与阅读端均已完成本地实现，当前迁移为 0001–0026，真实项目验收仍待完成。

本目录是服务端 PostgreSQL 仓储及迁移。当前没有网页/API 使用它，也没有读取 DATABASE_URL 或连接真实 Supabase；配置检查仍保持未接入。Clerk 身份、Slack 验证、运行账号权限及生产 RLS 策略在 T010–T016。

## 文件与职责

- migrations/0001_core.sql：members、documents、revisions、reviews、audit_log。
- migrations/0002_supporting_data.sql：分类、附件、个人记录、分析、配置及通知共 14 张辅助表；关系与接入边界见 [SUPPORTING_DATA.md](./SUPPORTING_DATA.md)。
- migrate.ts：显式传入 Pool；迁移事务、事务咨询锁、版本校验和；同版本重放不改业务数据，修改已执行的迁移会失败。
- repository.ts：create、execute、getForManagement。每次修改先锁文章、比对 sequence、复用领域规则，在同一连接和事务中保存所有变化。读取管理快照使用 repeatable read，避免多次查询混入不同版本。
- ../../domain/：可信身份输入下的角色和审核规则；不是公开接口。

成员表不复制 Clerk role 为第二套权限真相。当前 actor/reviewer 必须由未来可信服务端验证；仓储复核活动成员，锁住成员行直至写入结束，防止同时停用后仍继续提交。不得将请求 JSON 直接转换为 Viewer。

## 数据保证及限制

版本、审计不可更新或删除。每轮审核保留提交版本与人员，已结束的审核不可修改或删除。复合外键限制正式/工作版本指向同一篇资料。文档提交时检查审核、审计、OPS 范围等完整性。正式版指针与工作版本分离。

行锁保证同一篇文章的更新排队；等待结束后再次检查 sequence。冲突返回 CONFLICT，调用端需保留未保存文字，具体 UI 为 T032。连接失败或事务失败不会返回成功；后续接口需通过读回处理“提交成功但响应丢失”的不确定结果，不能盲目重试并声称重复成功。

私有 schema 开启 RLS 且没有用户策略，不授予 PUBLIC 使用/读写权限。当前测试用临时数据库所有者执行服务端操作，另用无权限角色验证 RLS 拒绝读取。这不代表生产最小权限账号或完整授权验收通过。迁移所有者仍能变更表结构；不可变触发器不等于防恶意数据库管理员。

正文仍为字符串快照，BlockNote 结构化内容另在 T031 设计。管理读取目前加载整篇文章历史，适合核心事务正确性验证；大版本量分页与性能在 T039/T058 处理。当前工作流仅通过受控仓储执行，未提供任意 SQL 写接口。

## 本地验收

Node 22.18–24.x，推荐 .nvmrc 的 Node 24。pg 为服务端依赖，embedded-postgres 仅 devDependency。

```sh
npm ci --ignore-scripts
# macOS Apple Silicon：只执行已检查的本平台二进制库链接脚本
npm rebuild @embedded-postgres/darwin-arm64
npm run test:db
```

其他平台须对应更换 embedded-postgres 的平台包并验证，不保证本轮已验收。该包的安装脚本只补全 node_modules 中的 PostgreSQL 库链接；若 npm 阻止脚本，按本机 npm 的依赖脚本批准设置处理，不要以 root 启动测试。

测试创建随机临时目录、随机端口、随机口令的真实 PostgreSQL，仅监听 127.0.0.1，不使用环境中的数据库 URL，不创建系统用户。完成后停止数据库并删除本轮临时目录。并发测试用两个独立连接，先证实两者都在等待数据库行锁，再释放锁检查单胜。故障测试注入审计失败，读回版本、审核和发布状态确认全部回退。

迁移回退测试仅在另一个全新临时集群删除本次 schema 后重建，用于空库迁移演练；不是线上降级脚本，不得照搬到真实数据库。生产备份恢复另属 T060。迁移不在网站启动时自动执行。

## 集成依据

- PostgreSQL 行锁：https://www.postgresql.org/docs/17/explicit-locking.html
- pg 同一连接事务：https://node-postgres.com/features/transactions
- Supabase PostgreSQL 连接：https://supabase.com/docs/guides/database/connecting-to-postgres
- 临时 PostgreSQL 工具：https://github.com/leinelissen/embedded-postgres

后续只由受保护服务端构造 Pool 并传入仓储，浏览器不获得连接串。实际 Supabase 连接方式、池化、TLS 和运行账号权限要在测试项目验证后确定。

T010：新增 0003_authorization.sql、ScopedDatabase 与统一服务端授权。生产仓储只接受事务接口；所有者事务适配器仅保留在 tests/database/fixture.ts。详见 `../authorization/README.md`。原 T008/T009 的默认拒绝说明代表当时基线；当前 runtime 已有按身份限制的读取和核心写入策略，其他未接功能仍拒绝。

T015 新增迁移 `0004_members`：成员观察字段、成员操作意图与不可改写历史、pending 和角色匹配的上下文校验。运行时新增两条受限连接配置，详见 `src/server/members/README.md`；迁移仍须显式执行，不能用迁移所有者充当运行账号。

T016 新增迁移 `0005_enrollment`：永久初始化单例与按账号唯一的角色开通意图，已有成员系统按已初始化处理。pending 开通也参与数据库身份拒绝，完成历史防改写。接入及失败恢复见 `src/server/enrollment/README.md`。


T024新增 `0006_article_presentation`：不可变版本的tags、cover_alt、cover_position；封面身份仍在revision_assets。DocumentRepository同事务保存封面并复制原版分类/其他附件，在审计写入前完成关联。新runtime插入策略限定新版本组装阶段；禁止重写已保存版本。`read_publication_presentation`只输出有权正式版元数据，现有`read_publication`返回签名不变。新版仓储必须先完成显式迁移，不能访问旧schema；不在页面或启动时自动迁移。旧迁移文件未改动。

标签限制12项、每项40字符。旧封面被隔离后继续编辑需显式移除或替换；T031表单需显示此错误与恢复动作。普通正文编辑保留原类别和附件，显式移除附件UI将在T027/T031实现。


T025新增`0007_feedback`：feedback增加乐观并发version，受限函数save_feedback锁定文章行后检查当前正式版本及可读权限。同一员工/文章/正式版本的相同重试保留原值，不增加计数/时间/版本；过期差异修改拒绝。运行账号无直接反馈表DML，管理员汇总仍经受限只读事务。旧迁移不修改、启动不自动迁移；本轮仅一次性本地库验收，真实Supabase迁移待配置。
