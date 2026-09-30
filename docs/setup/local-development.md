# 本地启动与环境接入

本页说明当前代码的本地启动方法。历史接入过程见 [Clerk Production 与 Vercel 接入记录](T059-clerk-production.md)；其中带日期的状态、部署提交和“待验收”描述属于当时的快照，不是当前环境的实时报告。

## 1. 安装与配置

项目使用根目录 [`.nvmrc`](../../.nvmrc) 指定的 Node.js 24.19.0；[package.json](../../package.json) 允许 `>=22.18.0 <25`。优先使用指定版本，使本机与 GitHub 检查保持一致。

```sh
nvm use
npm ci
test -f .env.local || cp .env.example .env.local
chmod 600 .env.local
```

在本机安全填写 `.env.local`，不要把真实密钥放入 README、截图、聊天或提交记录。模板见 [`.env.example`](../../.env.example)。本地开发应使用与正式环境分开的身份、数据和存储配置；不要用正式业务库试跑写入功能。

| 配置 | 用途与约束 |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`、`CLERK_SECRET_KEY` | 同一 Clerk 实例的公开与服务端密钥。实例类型必须一致；服务端密钥不暴露到浏览器。 |
| `APP_ORIGIN` | 应用的完整来源地址，本地为 `http://127.0.0.1:3211`；与实际访问地址一致。 |
| `ALLOWED_EMAIL_DOMAINS` | 公司邮箱域名，多个用英文逗号分隔，不加 `@` 或通配符。 |
| `ALLOWED_SLACK_TEAM_ID` | 已批准的 Slack 工作区 ID，不是 App ID 或显示名称。公司准入检查使用此值。 |
| `JUYU_DATABASE_RUNTIME_URL`、`JUYU_DATABASE_ISSUER_URL` | 同一数据库中的两个受限账号，分别处理业务访问和身份签发。不能使用迁移所有者，也不能把同一个管理员连接复制两遍。远程连接要求 `sslmode=verify-full`。 |
| `JUYU_DATABASE_CA_CERT` | 数据库证书验证所需的 CA PEM（若连接环境需要），不能关闭证书校验来代替配置。 |
| `NEXT_PUBLIC_SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY` | Supabase 项目地址与服务端 Storage 凭据。项目应与数据库匹配，文件桶为私有 `juyu-private`。 |
| 三项 `NEXT_PUBLIC_CLERK_SIGN_*` 路径 | 保留模板中的登录与跳转路径。修改公开配置后需要重新构建。 |
| `PDF_CHROMIUM_EXECUTABLE` | 可选，本地已安装 Chromium 的绝对路径。不填时使用本地 Playwright 浏览器；云端不能使用这台电脑的路径。 |

以下配置按需要启用，不是基础登录所需的 Bot 设置：

- `SLACK_BOT_TOKEN`、`SLACK_NOTIFICATION_CHANNEL_ID`、`CRON_SECRET`：用于出站通知和重试，见 [Slack 通知](slack-notifications.md)。Slack 登录与出站通知是两条独立连接。
- `JUYU_VALIDATE_LINKS_ACTOR_ID`：用于已发布资料链接检查，必须是当前有效的 Admin 或 Super Admin 的 Clerk user ID，见[检查与部署](verification-and-deployment.md)。

## 2. 数据库与私有存储

接入现有数据库前，先确认目标环境、迁移账本与备份。应用不会在启动或请求时自动执行数据库迁移，也不会自动建立文件桶。

- 数据库结构和迁移机制见[数据库说明](../../src/server/database/README.md)及[迁移目录](../../src/server/database/migrations/)。历史说明中的迁移数量不是当前全部迁移清单。
- 公司准入、受限账号和初始开通步骤见[测试环境接入](T059-test-environment.md)与[正式环境接入记录](T059-clerk-production.md)。测试路线的 Clerk 测试密钥要求只适用于测试实例。
- 私有桶与 Storage 策略见[私有附件说明](../../src/server/storage/README.md)及[策略文件](../../src/server/storage/supabase-setup/private-bucket-policy.sql)。不要将桶改为公开来解决读取问题。
- Slack 通知和可见停留统计的增量迁移分别见[通知说明](slack-notifications.md)与[分析说明](analytics-visible-time.md)。运行写入迁移前必须核对目标，不能把上线流程当作普通启动命令。

## 3. 启动网站

```sh
npm run dev -- --port 3211
```

访问 <http://127.0.0.1:3211>。员工入口为 `/help-centre`（登录页 `/sign-in`），管理员入口为 `/admin`（登录页 `/admin/sign-in`）。

没有模拟登录可代替真实公司准入。缺少配置或服务异常时，界面可能显示未连接、等待开通或登录错误；这与“网站进程已经启动”是不同状态。

## 4. 核对配置与可用性

Clerk 测试实例的开发配置检查：

```sh
npm run check:config -- --development
```

Clerk Production 配置检查：

```sh
npm run check:config -- --clerk-production
```

工具只检查配置格式，输出 `liveChecks=not_run`，不会证明真实密钥、OAuth 或数据库连通。Production 检查要求 HTTPS 来源地址，不应为了通过检查而把本地地址改成正式站地址。

`/api/health` 只证明网站进程存活；`/api/readiness` 检查应用准备状态。真实登录、成员权限、正式资料、文件与发布流程仍需使用目标环境的账号逐项验收。

返回[项目 README](../../README.md)。
