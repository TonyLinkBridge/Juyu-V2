# T012 · 员工身份与登录入口

> 2026-09-10 当前接入说明：[T059 测试环境配置](../../../docs/setup/T059-test-environment.md)。下文保留各阶段历史记录；公司准入、业务授权与阅读端均已完成本地实现，当前迁移为 0001–0026，真实项目验收仍待完成。

2026-09-08：本地 SDK 接入及本地验收完成；用户明确表示 Clerk 测试项目尚未准备，先完成本地接入。未创建 Clerk 实例或真实账号，未复制旧项目密钥。

## 已实现

- 安装并锁定 @clerk/nextjs 7.9.1、@clerk/localizations 4.16.0。
- Next.js 16 使用 src/proxy.ts 接入 clerkMiddleware，指定可信 APP_ORIGIN 为 authorizedParties。组件 Provider 仅在配置完整且格式通过时启用，不启用无密钥实例创建流程。
- /sign-in/[[...sign-in]] 支持 Clerk 多步骤登录路由；使用官方 SignIn 和中文翻译。校验失败/验证码等由官方组件处理；增加加载、连接失败提示与 /sign-in/error 恢复页。
- 登录和注册后重定向均固定到 /help-centre，退出固定到 /sign-in；不读取请求中的 redirect_url、returnTo、next 等作为本应用跳转目的地。真实 Clerk 回调参数覆盖行为仍需实际项目验收。
- 根入口及登录页在服务器读取会话；先由 auth 接受 session_token，再通过 Clerk Backend API 读取当前 session，核对 active 状态、session ID 和 user ID。自有代码不缓存此结果；每次服务端检查重新读取。
- 会话结果只有身份，不构造 companyVerified，不读取 role 或 slackTeamId 声明授予权限。
- 退出按钮通过 Clerk SDK 指定当前 session ID；处理等待、加载失败与退出失败。调用失败时不能声称退出成功。真实多会话行为仍待验收。
- Proxy 响应禁止共享缓存；健康和登录恢复路径不依赖 Clerk middleware 成功。服务端错误只进入固定恢复页或返回通用 AUTH_UNAVAILABLE。

## 当前访问边界

配置缺失时网站继续显示“登录服务尚未连接”。即使稍后填写 Clerk 配置，登录成功也只能看到“资料库访问尚未开通”和退出按钮。T013 公司邮箱/Slack 校验、T015 角色与成员映射、受限数据库连接集成尚未完成；applicationAuthorization 仍默认拒绝，因此文章和附件 API 不被单凭 Clerk 登录放行。

管理员入口及 Admin 检查属于 T014，本轮保留其未开放页面；员工页不显示后台切换。GitBook 阅读界面从 T017 开始，不能把当前待开通页面当作阅读端成品。

## 准备测试项目后

1. 在安全的本地配置处填写 NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY、CLERK_SECRET_KEY、APP_ORIGIN。不要在聊天、源代码、前端或日志中放 secret。密钥前后不能有空格；test/live 必须匹配。
2. APP_ORIGIN 使用实际访问的精确 origin（协议、主机及端口），不含路径、凭据或查询参数。远程地址须 HTTPS；本地可用 http://127.0.0.1:3211。localhost 与 127.0.0.1 是不同 origin，不混用。
3. 在 Clerk 测试实例设置允许的登录方式、应用地址和公司账户接入策略；正式公司邮箱和 Slack Workspace 规则按 T013 验证。组件本身不是公司准入控制。
4. 修改公开配置后重新构建并启动。配置格式通过不代表密钥真实有效，/api/readiness 仍反映整个业务授权链尚未集成。
5. 使用真实测试账号验收：登录成功、刷新保持状态、验证码错误、取消/失败回调、失效会话、网络中断后重试、退出后再请求、两会话仅当前会话退出、恶意外站 redirect_url、非公司账号不能读资料。

T012 不把这些云端检查勾选完成。后续读取公司身份必须复用可信服务端会话，不接受浏览器自报的 userId/role/companyVerified。

## 本地检查和限制

npm test 覆盖身份校验与退出参数；其中身份供应商和退出 SDK 使用测试替身，仅验证适配边界，不验证真实 Clerk 签名/远端会话。npm run test:e2e 在未配置密钥的真实本地 Next.js 中覆盖桌面/手机入口及失败恢复；不能替代真实登录。

本轮没有修改数据库迁移、RLS 或审核仓储。真实身份集成与云端验收前不开放资料读取。结果见 docs/verification/2026-09-08-employee-login.md。

官方参考：[Next.js 接入](https://clerk.com/docs/nextjs/getting-started/quickstart)、[自定义登录页面](https://clerk.com/docs/nextjs/guides/development/custom-sign-in-or-up-page)、[middleware 配置](https://clerk.com/docs/reference/nextjs/clerk-middleware)。具体接口参数另与已安装 SDK 类型和实现核对。

T013 更新：公司准入本地实现已接入，详见 COMPANY.md；上文 T012 的“公司校验尚未完成”现对应真实项目验收及后续业务角色/数据库绑定尚未完成。
