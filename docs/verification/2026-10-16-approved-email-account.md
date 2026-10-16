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


## 正式接入与后续开通界面修复

- 用户确认仅为指定账号添加 Production 配置，并要求将主登录邮箱换为新的公司邮箱。真实账号与邮箱仍只保存在 Clerk/Vercel，不写入本文件。
- Vercel `JUYU_APPROVED_EMAIL_ACCOUNT` 已作为仅 Production 的 Secret 保存；未展开、复制或更改其他密钥。
- `1236ad2` 已部署为 Production Ready，正式域名 `/api/health` 与 `/api/readiness` 均返回该提交；readiness 为 ready，只证明其声明的公开签名密钥与数据库检查。
- 浏览器回读同一 Clerk 用户的新主邮箱为 Verified；角色仍为 super_admin、没有关联 Slack。真实已登录会话的 `/api/auth/enrollment` 返回 ready / super_admin；知识库主页与后台文章管理均正常加载，账号菜单确认新邮箱与超级管理员身份。未代理本人输入密码，未发布或修改正文资料。
- 发现现有开通界面只接受 admin/support/ops，遗漏 super_admin，因此即使开通接口成功，页面仍显示通用失败，手动刷新后才进入主页。新增桌面/移动端复现测试，修改前两个 super_admin 用例均因没有自动刷新失败。
- 修复仅补上合法 super_admin 角色；四种合法角色均自动刷新，非法角色、等待、拒绝行为维持原规则。16 项开通界面测试通过，并将该测试文件纳入 `test:critical`。
- 最终版本重新执行 `npm run verify:build`，603 项单元测试、类型检查、lint 与正式构建、构建后资源检查通过；只剩原有 lint warning。后续补丁部署与 GitHub Verify 状态须独立读取，不能从本地验证推断。
