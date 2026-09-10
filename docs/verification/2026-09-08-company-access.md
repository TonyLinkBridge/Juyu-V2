# T013 · 公司准入本地验收

日期：2026-09-08。项目 /Users/tony/Documents/ChatGPT/Juyu V2。

## 已完成

- 可信 Clerk 会话之后，读取服务端主邮箱、用户状态及关联 Slack 账号；校验精确公司域名、已验证邮箱和令牌归属。
- 固定 Slack HTTPS userInfo 校验 Workspace、同一邮箱与 subject；不信任手写 metadata 或直接解码 ID Token。
- 员工页面公司验证状态；无敏感信息的 /api/auth/company 接口；业务文章/附件授权继续默认关闭。
- 供应商失败、未知错误和临时迁移状态按 unavailable 处理；验证不符合按 denied 处理，不把供应商故障错误归咎于用户账号。

## 本地证据

- npm test：90/90 通过，0 失败、0 跳过；T013 新增 14 项。
- npm run test:e2e：14/14 通过，桌面 7、手机 7；在未配置真实账号的 production build 上运行，覆盖原入口及新公司接口的伪造身份拒绝。
- npm run build、npm run typecheck、npm run lint：通过。
- 临时真实本地 HTTP 测试验证发送方法/Authorization、302 不跟随，接收重定向的目标未收到请求。实际 Slack HTTPS 调用本轮没有执行。
- 测试包含域名后缀欺骗、未验证/错误主邮箱、禁用用户、伪造 metadata/ID Token、外来及重复令牌、外来 subject、错误 Workspace、撤销、HTTP 失败/坏 JSON/超大响应、状态返回无身份或令牌泄漏。
- 公司身份供应商使用测试替身；本轮不声称验证了真实 Clerk 签名、真实 Slack 成员身份、实际撤销或回调。
- 数据库实现未改，本轮没有重跑数据库测试；旧的数据库测试结果不计为新证据。

## 审查与修复

独立审查发现 Slack HTTP 200 的 ok:false 临时故障被误归为账号拒绝。回归先复现失败，再明确将临时故障、限流、未知错误和 org_login_required（Workspace 迁移）归为 unavailable。缺配置/未登录测试加强为调用次数必须为零，并精确断言状态，避免异常被捕获后产生假通过。修复后全部单元测试通过。

## 尚未完成

用户已表示会提供邮箱域名和 Workspace ID，但尚未收到具体值；Clerk/Slack 测试实例仍未配置，真实联合验收待办。T013 整体保持进行中；目前仅本地实现完成。没有修改真实账号或元数据，没有部署。

下一项 T014：独立后台入口与 Admin 检查；T015 继续角色/成员及受限数据库接入。完整真实登录、公司准入、阅读和附件访问须联合验收，不以单一页面或状态接口代替。

接入说明：src/server/authentication/COMPANY.md。
