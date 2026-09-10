# T059 · Clerk Production 与 Vercel 接入

2026-09-10 实际核对：仓库 https://github.com/TonyLinkBridge/Juyu-V2.git 已关联 Vercel 的 Juyu → helpcentre 项目，当前部署提交为 `fc49266`，地址为 https://juyu-helpcentre.vercel.app 。Clerk Production 已创建，Domains 页面明确支持此 Vercel 域名，通过 `/__clerk` 代理连接，无需用户配置 `vercel.app` 的 DNS。此前“必须先有自有域名”的判断已撤回。

接入前快照：Clerk 域名 Unverified；线上 `/__clerk/v1/environment` 返回 404；Vercel 仅有 Development 环境的 Clerk 测试密钥，Production 密钥和 APP_ORIGIN 尚未配置。该快照不是最终验收结果。

本轮进展：用户已确认将当前 Clerk 实例生产密钥保存到 Vercel 的 helpcentre 项目 Production 并重新部署。已保存 `APP_ORIGIN=https://juyu-helpcentre.vercel.app`、生产公开密钥和服务端 Secret；界面回读确认三项均属于 Production，原 Development 测试密钥保留。服务端密钥使用不可回显的 Secret 类型，不进入源码或本地 env。部署 `C2pmpr1Z4YtvLZTomjeMFtvbB9GT`（现有 `fc49266` 源码）已 Ready。

线上验收：Clerk Domains 点击 Verify proxy 后变为 Verified，清单 1/2；`/__clerk/v1/environment` 与 `/api/health` 均 HTTP 200。员工 `/sign-in` 和管理员 `/admin/sign-in` 均实际加载“登录 JuyuV2”邮箱表单。当前无 Slack 按钮；未创建首个生产用户，未验证真实登录/退出、公司准入或管理员角色。`/api/readiness` 仍 HTTP 503，返回 configuration=missing、authentication=not_integrated、database=not_integrated；完整资料库仍未就绪。页面仍显示指向 Account Portal 子域名的注册链接，当前代理模式的注册入口需后续处理，不视为已验收。

离线检查已允许 Vercel HTTPS 项目地址，上一轮 338 项单元测试与 TypeScript 检查通过。本轮仅外部配置及文档更新；本地检查规则、测试与文档修改尚未提交或推送。

## Slack 接入配置与当前验收

已通过 Slack 应用管理页面核对现有应用 `Juyu V2`（`A0C0MG9FHAP`），所在 Workspace 为 `juyu`，实际 ID `T094DTFCVA8`；该 ID 来自当前应用设置 URL 和安装链接，并非直接采用历史示例。用户确认后，Clerk Production 的标准 Slack OAuth 连接已 Enabled，并开启 sign-up/sign-in。

Clerk 当前生成的回调 `https://juyu-helpcentre.vercel.app/__clerk/v1/oauth_callback` 已保存到 Slack 应用，Client ID/Client Secret 已保存到当前 Clerk Production；密钥没有写入源码或本地 env。Vercel helpcentre 的 Production 已保存 `ALLOWED_EMAIL_DOMAINS=juming.hk,juyu.com,juyu.hk` 与 `ALLOWED_SLACK_TEAM_ID=T094DTFCVA8`，部署 `GZaHrM6epcNRUrK7uByNFZViiwHs`（`fc49266`）已 Ready。本地 Workspace env 仍未改动。

线上员工登录页已出现“使用 Slack 登录”，点击后实际到达 juyu Workspace 的“Sign in to Juyu V2 with Slack”授权页；请求为 `openid,email,profile`，没有聊天、频道或文件权限。已停在 Accept and Continue，等待用户完成真实账号授权；该按钮同时接受应用条款并共享姓名、邮箱、头像、用户 ID 与 team ID。尚未完成 OAuth 回调、真实公司账号准入/拒绝、首个 Admin、数据库或退出验收；按钮出现和部署 Ready 不代表完整资料库已可用。

用户随后自行完成授权。本次页面回读已进入 `/help-centre`，明确显示“公司账号验证已通过。资料库仍在准备中，请等待管理员完成开通。”，并提供退出登录按钮。因此当前真实账号的 Slack 回调及公司邮箱/Workspace 正向校验已通过；尚未测试不合格账号拒绝和退出。当前停在“资料库访问尚未开通”，Vercel 仍缺少两条受限数据库连接（`JUYU_DATABASE_RUNTIME_URL`、`JUYU_DATABASE_ISSUER_URL`）；代码中的 enrollment 在数据库配置缺失时不会开通资料库账号。下一步为 Supabase 结构/受限账号/连接接入，再验收首个 Admin；未手动绕过公司或角色检查。

## 现在需要填什么

| 变量 | 当前本地检查 | 要填的内容 |
| --- | --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | 已填写，格式检查通过 | Supabase 项目 HTTPS 地址；尚未验证实际项目 |
| SUPABASE_SERVICE_ROLE_KEY | 已填写 | 仅服务端使用，尚未验证有效性及项目匹配 |
| ALLOWED_EMAIL_DOMAINS | 三个域名格式通过 | 已将空格分隔改为英文逗号，未更换域名 |
| NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY | 未填 | Clerk Production 实例 → API keys → pk_live 开头的公开密钥 |
| CLERK_SECRET_KEY | 未填 | 同一 Production 实例 → API keys → sk_live 开头的服务端密钥 |
| ALLOWED_SLACK_TEAM_ID | 未填 | 公司 Slack Workspace 的 T 开头 ID，不是 Slack app ID、Client ID 或名称 |
| JUYU_DATABASE_RUNTIME_URL | 未填 | 数据库结构初始化后，为受限业务登录账号生成的连接 |
| JUYU_DATABASE_ISSUER_URL | 未填 | 同一数据库中另一个受限身份签发账号的连接 |
| APP_ORIGIN | 本地仍为预览地址 | Vercel Production 填 https://juyu-helpcentre.vercel.app，不带路径；不能填 Clerk 的认证子域名 |
| 三项 NEXT_PUBLIC_CLERK 登录路径 | 已填写 | 保留 /sign-in、/help-centre、/help-centre |
| PDF_CHROMIUM_EXECUTABLE | 可选 | Vercel PDF 运行环境尚未适配，不可填写这台 Mac 的路径作为云端路径 |

两条数据库连接不是 Supabase API key，也不能把同一个 postgres 管理员连接复制两遍。需要先明确目标数据库和初始化变更，创建权限不同的两个账号；详细约束见原配置指南。

## 正式实例的前提与顺序

1. 当前采用 Clerk 的 Vercel 代理方案。安装的 `@clerk/nextjs` 7.9.1 会在生产密钥和 `*.vercel.app` 请求下自动处理 `/__clerk`；现有 `src/proxy.ts` matcher 已覆盖该路径。ClerkProvider 根据 Vercel 的 `VERCEL_TARGET_ENV=production` 和 `VERCEL_PROJECT_PRODUCTION_URL` 自动使用该代理，项目已开启 System Environment Variables。保留这些系统变量，不设置 `CLERK_DISABLE_AUTO_PROXY`；不要只设置 `NEXT_PUBLIC_CLERK_PROXY_URL` 而忘记相应显式服务端代理配置。[Clerk 代理指南](https://clerk.com/docs/guides/dashboard/dns-domains/proxy-fapi)
2. 在 Vercel Production 配置当前 Clerk 实例的 pk_live / sk_live 密钥和 APP_ORIGIN，重新部署后，在 Clerk Domains 点击 Verify proxy。自有域名仍可后续用于品牌与 Account Portal；当前不以购买域名为前置条件。
3. 配置 Slack 正式 OAuth。Clerk → SSO connections → Slack 使用自有凭据；在 Slack app 配置 Clerk 显示的 Redirect URL，并将 Slack Client ID / Client Secret 填入 Clerk。这两个 Slack 凭据不是本应用的 ALLOWED_SLACK_TEAM_ID，也不用新增到应用 env。[Clerk Slack 指南](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/slack)
4. 在 Vercel 项目的 Settings → Environment Variables 配置 Production 环境；本地 .env.local 不会因上传源码而自动同步。修改后重新部署才生效。不要把密钥文件上传 GitHub；Preview/Development 不要无差别套用正式凭据。[Vercel 环境变量](https://vercel.com/docs/environment-variables)
5. 准备数据库迁移、受限账号、私有桶与首位管理员安排，再做真实身份、附件和审核发布验收。使用 Production 身份服务不等于允许未经验证就对全体员工开放。

## 本地检查工具

```sh
npm run check:config -- --clerk-production
```

此入口明确选择 Clerk 正式实例，要求成对 live 密钥和有效 HTTPS 应用地址，允许 Vercel 项目域名。输出 clerkInstance=production、liveChecks=not_run；格式通过仍不证明代理、DNS、真实密钥、Slack OAuth、项目匹配或权限有效。它不联网、不创建资源、不推送 GitHub、不部署 Vercel。

默认 `npm run check:config` 仍检查 Clerk 测试实例。输出 mode=production 只代表按 Next production 模式读取 env 文件，不能把它理解为已经选择 Clerk Production。两者通过参数明确区分。

本机继续用本地 APP_ORIGIN 是正常的；不要为了让正式预检通过而改变本地开发地址。正式检查针对最终部署配置，缺失地址时保持未通过。

## 当前已确认的 Vercel 适配问题

- 当前文件通过本站 API 上传，允许视频最大 50 MiB、PDF 20 MiB、图片 5 MiB；普通 Vercel Function 请求体上限为 4.5 MB，现有大文件链路不能原样上线。必须设计保留权限控制的文件传输方案并真实验证，不能直接把私有桶开放。[Vercel Functions 限制](https://vercel.com/docs/functions/limitations)
- 当前 PDF 使用 playwright-core 启动本机 Chromium；现有部署配置没有提供 Vercel 可执行的 Chromium。云端 PDF 尚未验收，不能把本地生成成功当作云端可用。

优先验证当前 HTTPS 地址上的登录与公司准入。大文件、PDF、数据库与完整业务链路完成后，才能扩大员工使用范围。源码已推送并部署，但这不代表真实账号、数据库与业务功能已验收。

### 2026-09-10 Supabase initialization verified

- Target: `zscxaqjqjoouiolkoxbi` (知识库v2), session pooler `aws-0-ap-southeast-1.pooler.supabase.com:5432`.
- Existing `migrate()` applied all 26 migrations; repeat invocation returned no pending migrations. Ledger checksums retained.
- 37 tables in `juyu`; all have RLS enabled.
- Created `juyu_app_runtime` and `juyu_app_issuer`; real login checks passed. Neither has superuser, bypass-RLS, create-role or create-database privileges. Each belongs only to its respective application capability role.
- Generated runtime/issuer URLs stored only in local `.env.local` (mode 0600); no credentials recorded here or uploaded to Vercel.
- Created Storage bucket `juyu-private`, verified `public=false`; applied restrictive `juyu_private_server_only` policy for `anon,authenticated`.
- TLS client verification passed with the official CA linked by Supabase Database Settings: https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt . Temporary local certificate: `/tmp/juyu-supabase-ca.crt`. CA trust must be configured durably for application/deployment; verification must remain enabled.
- Pending: production runtime/issuer and Storage configuration, durable CA integration, deployment, first Admin enrollment and real end-to-end account/attachment acceptance. Database initialization is not website readiness.
