# T059 · 专用测试环境接入

> 当前方向已更新：用户选择 Clerk Production，见 [正式环境接入与待填项](T059-clerk-production.md)。本页测试实例要求仅适用于测试路线；不要用默认测试预检判断正式密钥是否有效。

2026-09-10：用户已确认专用 Clerk 与 Supabase 测试项目准备好，会在本地填写。当前完成的是本地配置准备，尚未验证真实项目或账号。本文是当前接入说明；T008–T016 文档描述的是当时的阶段状态。

## 1. 本地填写

文件：项目根目录 `.env.local`。工具只在文件不存在时创建空模板，不覆盖已有内容；新文件仅当前系统用户可读写。不要把密钥发到聊天、截图、任务记录或提交到仓库。

| 配置 | 填写内容 |
| --- | --- |
| NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY | 专用 Clerk 测试实例的 pk_test 开头公开密钥 |
| CLERK_SECRET_KEY | 同一测试实例的 sk_test 开头服务端密钥 |
| NEXT_PUBLIC_SUPABASE_URL | 专用 Supabase 测试项目的 HTTPS 项目地址，无额外路径 |
| SUPABASE_SERVICE_ROLE_KEY | 同一测试项目的服务端 Storage 凭据，绝不能改成 NEXT_PUBLIC 变量 |
| ALLOWED_EMAIL_DOMAINS | 允许的公司邮箱域名，例如 example.com；多个用英文逗号，不加 @ 或通配符 |
| ALLOWED_SLACK_TEAM_ID | 公司 Slack Workspace ID，T 开头，不填显示名称 |
| JUYU_DATABASE_RUNTIME_URL | 受限业务数据库登录连接；尚未创建此账号可先留空 |
| JUYU_DATABASE_ISSUER_URL | 独立受限身份签发登录连接；尚未创建此账号可先留空 |

保留模板中的本地 APP_ORIGIN 与三项登录跳转配置。访问地址使用 http://127.0.0.1:3211，不混用 localhost。远程测试地址须 HTTPS 并同步 APP_ORIGIN。PDF_CHROMIUM_EXECUTABLE 可留空，后续检查本机浏览器是否可用。

两条数据库 URL 都要用户名、密码、数据库名；用户名不同，服务器与数据库相同。远程连接必须 `sslmode=verify-full`。密码中的 URL 特殊字符须编码；Next 环境文件会展开 `$`，字面美元符号须转义。不要为通过连接检查而降低 TLS 校验。

## 2. 离线检查

```sh
npm run check:config
# 使用 next dev 时检查对应配置优先级：
npm run check:config -- --development
```

默认与 production 模式一致：已有进程变量优先，其后 `.env.production.local`、`.env.local`、`.env.production`、`.env`。development 对应替换 production。遇到重复设置应自行核对来源；工具不会打印文件内容或具体配置值。

输出只含变量名称和固定状态：

- `blocked`：缺项、格式错误，或误用了 Clerk live 密钥；退出码 1。
- `ready_for_connection_checks`：本地格式可进入下一阶段；退出码 0。
- `liveChecks: not_run`：没有验证密钥真假、账号所属项目、网络、数据库权限、迁移、存储桶或真实登录。

检查不联网，不执行迁移，不创建桶或用户，不修改 Clerk。Supabase 项目是否为专用测试项目、密钥是否与 URL 配对，不能单凭格式确认。数据库实际权限和连接池模式同样需要下一阶段检查。

修改 NEXT_PUBLIC 配置后要重新构建并重启网站。检查命令不会自动重启当前预览。现有 `/api/readiness` 仍保守返回 503，其 not_integrated 字段不能作为实时连通诊断；不要改成“变量齐全即返回成功”。

## 3. 真实接入顺序（尚未执行）

1. 核对专用测试项目身份和实际域名/Workspace；仅记录非密钥项目标识。先做只读连通和现有状态检查。
2. 准备可审阅的初始化操作清单：指定 Supabase 项目、当前迁移状态、预期变更。应用当前包含 0001–0026 共 26 个迁移，入口 `src/server/database/migrate.ts`。必须显式运行，页面和启动不会代执行。不要仅照旧文档执行前四个迁移，也不要绕过迁移记录和校验和直接拼接 SQL。
3. 使用独立的迁移所有者建立结构；创建两个不同受限 LOGIN，分别持有 `juyu_runtime` 和 `juyu_context_issuer` 能力。运行连接不能是 owner、superuser、BYPASSRLS、能创建角色/数据库或混合两种能力的账号。迁移所有者连接不放进应用运行变量。
4. 数据库使用直连或 session pooling。真实检查要确认身份绑定和连接复用正常，不能用 transaction pooling。TLS 证书或网络有问题须定位原因，不能关闭验证。
5. 明确指定测试项目中的 `juyu-private` 私有桶和访问政策后再建立。`supabase-setup/private-bucket-policy.sql` 需桶已存在且是私有；单有私有桶仍需验证直接访问、旧链接和越权读取。不能复用旧业务项目的桶或密钥。
6. Clerk 测试实例启用 Slack 登录并核对实际回调；用真实公司邮箱及同一 Workspace 账号登录。metadata 中手写 slackTeamId/slackVerifiedAt 不能替代服务端核验。
7. 首次访问前确定首位管理员测试账号：空库中首位通过公司校验且尚无角色的账号会自动获得 Admin，并写入数据库与 Clerk。这不是只读操作。首位账号准备妥当后再进行真实登录。二审需要第二个不同 Admin；后续新账号默认 Support。
8. 构建并重启配置后的站点，按下方清单记录真实证据。日志只记录结果及必要的非密钥标识，不记录 token、连接密码或附件签名地址。

数据库初始化、建桶、角色创建及首次管理员开通均属于明确的实际变更，要核对具体对象后执行；本地预检不会偷偷代办。

## 4. 待验收

- [ ] 核对 Clerk 与 Supabase 指定测试项目及公司准入配置。
- [ ] 真正连接数据库，核验 26 个迁移、两种受限能力及 TLS/session pooling。
- [ ] 私有桶、访问政策、上传下载、拒绝外部直读和撤权后旧链接。
- [ ] Clerk 登录、Slack 回调、公司邮箱/Workspace 拒绝、退出、过期和失效会话。
- [ ] 首位 Admin、后续 Support、第二位 Admin、Ops；当前角色修改与撤销同步。
- [ ] 两管理员提交/二审/批准/发布，旧正式版本持续可读，改稿重新审核。
- [ ] Support/Ops 的文章、搜索、附件、PDF 和自定义入口权限联合验收。
- [ ] 实际 PDF 与云端附件、真实设备和部署规模检查；这些不由本地性能夹具替代。

每项写明测试时间、专用项目非密钥标识、预期/实际结果与失败情况；全部所需真实检查完成前，T059 保持进行中。

## 官方参考

- [Supabase PostgreSQL 连接方式](https://supabase.com/docs/guides/database/connecting-to-postgres)：直连及连接池使用方式。
- [Supabase SSL](https://supabase.com/docs/guides/platform/ssl-enforcement)：严格证书验证可能需要项目 CA，不能把关闭验证当修复。
- [Clerk Slack 登录](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/slack)：Slack 连接配置和服务端 token 获取。
- [Supabase 存储桶](https://supabase.com/docs/guides/storage/buckets/fundamentals)与[访问控制](https://supabase.com/docs/guides/storage/security/access-control)：公有桶与服务端凭据的权限边界。

Next 环境变量加载规则已与本项目安装的 Next 16.3.4 文档核对。
