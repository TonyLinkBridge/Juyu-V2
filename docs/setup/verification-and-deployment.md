# 检查与部署

以下命令以根目录 [package.json](../../package.json)、[Playwright 配置](../../playwright.config.ts)和 [GitHub 工作流](../../.github/workflows/)为准。测试结果只证明本次执行覆盖的范围，不能自动等同于正式服务验收。

## 本地检查

先使用 `.nvmrc` 指定的 Node.js 24.19.0，并执行 `npm ci`。

| 命令 | 检查内容 | 前置条件与边界 |
| --- | --- | --- |
| `npm run verify:build` | 类型、lint、单元测试、生产构建和构建后的样式/浏览器文件检查。 | 不包含数据库、PDF 渲染或真实账号验收。 |
| `npm run test:critical` | 核心员工阅读、编辑、收藏、OPS、Reference、Q&A、等待状态与媒体库的桌面/手机浏览器检查。 | 先构建，安装 Chromium，保持 `3210` 端口空闲；使用本地夹具，真实登录和数据库配置在测试服务器中关闭。 |
| `npm run test:db` | 在一次性本地 PostgreSQL 中验证迁移、权限、事务和并发规则。 | 需要 embedded-postgres 的本平台二进制；测试自行创建临时库，不使用正式业务库。 |
| `npm run test:pdf` | 实际 Chromium 渲染、PDF 与流程图检查，并生成本地样例。 | 需要可用 Chromium 和仓库内中文字体，生成文件放在 `output/`。 |
| `npm run test:e2e` | 完整桌面/手机浏览器测试。 | 先完成构建和 `test:pdf`，部分测试读取其生成的 PDF 样例；`3210` 端口必须空闲。 |
| `npm run test:scale` | 合成大文章、数据库、上传与 PDF 规模检查。 | 需要本地 PostgreSQL、Chromium；本机性能不能代表云端吞吐。 |
| `npm run test:recovery` | 一次性本地库及文件备份恢复演练。 | 需要 `pg_dump`、`pg_restore`，可通过 `JUYU_PG_BIN` 指定目录，见[恢复指南](T060-backup-recovery.md)。 |
| `npm run validate:links` | 检查数据库内当前已发布资料的站内链接与标题锚点。 | 需要已迁移数据库、两条受限连接及有效管理员 ID；只读该账号有权读取的资料，不校验所有外部网页，也不检查仓库 Markdown 链接。 |

核心检查顺序：

```sh
npm run verify:build
npx playwright install chromium
npm run test:critical
```

需要全量浏览器检查时，在构建完成后先执行 `npm run test:pdf`，再执行 `npm run test:e2e`。数据库二进制和恢复演练细节见[数据库说明](../../src/server/database/README.md)与[恢复指南](T060-backup-recovery.md)。

## 自动检查

[Verify](../../.github/workflows/verify.yml) 在拉取请求及 `main` 推送时执行依赖安装、Chromium 安装、`verify:build` 和 `test:critical`。失败时上传浏览器失败记录；单个检查通过不代表整个工作流通过。

[Validate Published Links](../../.github/workflows/validate-links.yml) 在以下情况运行：

- `main` 推送触发的 Verify 成功后。
- 每天 09:00（Asia/Kuala_Lumpur）。
- GitHub 页面手动触发。

此工作流要求仓库配置 `JUYU_DATABASE_RUNTIME_URL`、`JUYU_DATABASE_ISSUER_URL`、`JUYU_VALIDATE_LINKS_ACTOR_ID` 和 `JUYU_DATABASE_CA_CERT` secrets。管理员身份及配置缺失或失效时会失败，不会静默跳过。不要将连接值写入文档或提交记录。

## 部署顺序

1. 确认本地检查结果、目标环境和所需数据库迁移；保留备份与恢复路径。
2. 在目标数据库显式执行所需迁移，并核对迁移账本；应用构建和启动都不会代替迁移。
3. 在 Vercel 对应环境配置 Clerk、公司准入、两条受限数据库连接与私有存储。Preview、Development 和 Production 分开配置；本机 `.env.local` 不会随源码自动上传。
4. 核对 [vercel.json](../../vercel.json)：构建为 `npm run verify:build`，区域为 `sin1`，通知重试计划为每五分钟一次。配置变化后重新部署；计划存在不代表目标环境实际调用或通知送达已验证。
5. 验证实际部署提交，并使用真实账号检查登录、准入、阅读权限、审核发布、图片附件和 PDF。启用通知时，另检查真实频道送达与失败重试。
6. 在[验收记录](../verification/)中记录目标环境、提交、检查范围、结果和未完成项。

Slack 通知部署前需要 `0054_slack_outbox`；可见停留统计需要 `0055_analytics_visible_time`。对应脚本、前提和验证步骤见[通知说明](slack-notifications.md)及[分析说明](analytics-visible-time.md)。这些是专项迁移，不能代替全部数据库初始化。

推送 GitHub、CI 通过、Vercel Ready、真实账号验收和 Slack 送达是不同状态，应分别确认。

返回[项目 README](../../README.md)。
