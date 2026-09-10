# T059 · Clerk Production 与 Vercel 接入

2026-09-10：用户决定使用 Clerk Production，提供仓库 https://github.com/TonyLinkBridge/Juyu-V2.git 。仓库内容、上传状态和 Vercel 部署尚未核实；当前本地目录没有 Git 或 Vercel 项目关联记录。用户随后确认：正式域名尚未确定，Vercel 项目尚未建立。此前测试项目路线保留为可选方式，本页是当前方向。

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
| APP_ORIGIN | 仍为本地预览地址 | Vercel 正式环境填实际 HTTPS 自有域名，不带路径；不能填 Clerk 的认证子域名 |
| 三项 NEXT_PUBLIC_CLERK 登录路径 | 已填写 | 保留 /sign-in、/help-centre、/help-centre |
| PDF_CHROMIUM_EXECUTABLE | 可选 | Vercel PDF 运行环境尚未适配，不可填写这台 Mac 的路径作为云端路径 |

两条数据库连接不是 Supabase API key，也不能把同一个 postgres 管理员连接复制两遍。需要先明确目标数据库和初始化变更，创建权限不同的两个账号；详细约束见原配置指南。

## 正式实例的前提与顺序

1. 确定自有域名并接入 Vercel。Clerk Production 不能只使用平台默认的 *.vercel.app 域名，需要配置自己域名上的 DNS。按 Clerk Domains 页面给出的真实记录操作，不猜记录值。[Clerk Vercel 指南](https://clerk.com/docs/guides/development/deployment/vercel)
2. 创建或选择 Clerk Production 实例，核对 DNS、应用地址及登录路径；使用同一实例的 pk_live / sk_live 密钥。[Production 指南](https://clerk.com/docs/guides/development/deployment/production)
3. 配置 Slack 正式 OAuth。Clerk → SSO connections → Slack 使用自有凭据；在 Slack app 配置 Clerk 显示的 Redirect URL，并将 Slack Client ID / Client Secret 填入 Clerk。这两个 Slack 凭据不是本应用的 ALLOWED_SLACK_TEAM_ID，也不用新增到应用 env。[Clerk Slack 指南](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/slack)
4. 在 Vercel 项目的 Settings → Environment Variables 配置 Production 环境；本地 .env.local 不会因上传源码而自动同步。修改后重新部署才生效。不要把密钥文件上传 GitHub；Preview/Development 不要无差别套用正式凭据。[Vercel 环境变量](https://vercel.com/docs/environment-variables)
5. 准备数据库迁移、受限账号、私有桶与首位管理员安排，再做真实身份、附件和审核发布验收。使用 Production 身份服务不等于允许未经验证就对全体员工开放。

## 本地检查工具

```sh
npm run check:config -- --clerk-production
```

此入口明确选择 Clerk 正式实例，要求成对 live 密钥和 HTTPS 自有域名。输出 clerkInstance=production、liveChecks=not_run；格式通过仍不证明 DNS、域名所有权、真实密钥、Slack OAuth、项目匹配或权限有效。它不联网、不创建资源、不推送 GitHub、不部署 Vercel。

默认 `npm run check:config` 仍检查 Clerk 测试实例。输出 mode=production 只代表按 Next production 模式读取 env 文件，不能把它理解为已经选择 Clerk Production。两者通过参数明确区分。

本机继续用本地 APP_ORIGIN 是正常的；不能为了让正式预检通过就把尚未部署的域名随意写进去。正式检查针对最终部署配置，缺失域名时保持未通过。

## 当前已确认的 Vercel 适配问题

- 当前文件通过本站 API 上传，允许视频最大 50 MiB、PDF 20 MiB、图片 5 MiB；普通 Vercel Function 请求体上限为 4.5 MB，现有大文件链路不能原样上线。必须设计保留权限控制的文件传输方案并真实验证，不能直接把私有桶开放。[Vercel Functions 限制](https://vercel.com/docs/functions/limitations)
- 当前 PDF 使用 playwright-core 启动本机 Chromium；现有部署配置没有提供 Vercel 可执行的 Chromium。云端 PDF 尚未验收，不能把本地生成成功当作云端可用。

优先验证固定正式域名上的登录与公司准入。大文件、PDF、数据库与完整业务链路完成后，才能扩大员工使用范围。当前未推送、未部署、未创建真实账号或数据库对象。
