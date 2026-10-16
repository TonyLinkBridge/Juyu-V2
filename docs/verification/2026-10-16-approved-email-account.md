# 单账号邮箱准入 · 2026-10-16

## 范围

仅为服务器明确批准的一个 Clerk 用户提供无需 Slack 的公司身份准入路径，批准配置同时绑定用户 ID 与已验证主邮箱。所有其他账号保留原 Slack Workspace 检查；不改公司域名、Clerk 角色、成员停用、文章权限、文章链接或数据库结构。真实账号的 ID 与邮箱只保存于部署环境，不写入源码。

## 本地证据

- 新增 `tests/approved-email-account.test.ts`：修改前 4 项正向/角色传递测试失败，原代码返回 `denied / slack_connection`；修改后新增 8 项全部通过。
- 公司身份、管理员入口、成员与开通的针对性单元测试共 39 项通过。覆盖准确 ID 与邮箱、换邮箱、其他账号、锁定/禁止、未验证邮箱、配置撤销、配置非法与伪造 metadata、原 Slack Workspace 拒绝、角色保留、公开诊断脱敏。
- `npm run verify:build`：类型检查、代码规范、603 项单元测试、正式构建和构建后资源检查通过。存在原有匿名默认导出 lint warning，没有 lint error。
- `playwright test tests/e2e/foundation.spec.ts`：桌面与移动端共 34 项通过，覆盖登录入口、伪造身份、公司准入、后台/成员/正文/API 的拒绝行为。
- 本地一次性数据库成员及开通测试：首次 26/27 通过，并发首次开通测试发生 `terminating connection due to administrator command`；未修改生产逻辑或数据库测试，复查 27/27 通过。该首次连接错误未能稳定重现，不归因为正式数据库故障。

## 生产验收边界

服务器批准配置未设置时，例外不生效。仍需要在正确 Vercel Production 环境保存仅含 `userId` / `email` 的 `JUYU_APPROVED_EMAIL_ACCOUNT`，部署对应提交，再由账号本人通过 Clerk 邮箱登录完成验收。不得将本地测试、构建通过或配置保存等同于真实账号已能登录。

撤销方式：删除该环境变量并重新部署。账号 ID/邮箱不匹配、未验证邮箱或 Clerk 锁定/禁止的变更在后续验证中生效；成员停用、角色及资料范围仍由原权限链路核验。
