# T013 · 公司邮箱与 Slack Workspace

本地实现；未连接真实 Clerk、Slack 或 Supabase。用户表示将提供公司邮箱域名和 Workspace ID，本轮尚未收到具体值，因此允许列表保持空白。没有把示例 ID 当作真实配置，没有修改 Clerk metadata 或创建账号。

## 流程

1. 复用 T012 可信服务端会话，重新核对 Clerk 会话 active 状态。
2. 读取当前 Clerk 用户，拒绝 banned/locked 或 user ID 不匹配。
3. 只接受主邮箱且 verification.status=verified；邮箱域名精确匹配 ALLOWED_EMAIL_DOMAINS，不自动允许子域、通配符或别名。邮箱按小写比较，不做 Gmail 点号或加号转换。
4. 找到唯一的标准 Slack 关联账号，验证状态为 verified 且邮箱与主邮箱相同。多条同邮箱 Slack 关联记录会拒绝，需管理员先清理歧义。
5. 从 Clerk Backend API getUserOauthAccessToken(userId, 'slack') 取令牌；必须唯一对应上述 externalAccountId，不选择任意列表第一项。
6. 服务器向固定 HTTPS Slack openid.connect.userInfo 发起请求；禁止重定向、共享缓存，10 秒超时，响应最多 64 KiB。令牌只放请求头，不返回浏览器、不记录日志。
7. 核对 Slack ok=true、email_verified=true、同一邮箱、指定 team_id、sub 与 Clerk providerUserId 一致；若返回 Slack user_id，也必须一致。

不接受 publicMetadata 中手写的 slackTeamId、slackVerifiedAt、role 或直接解码的 idToken 作为公司验证证据。每次调用重新验证，不使用 metadata 时间戳缓存。若将来需要缓存，必须设计独立的可信证据、有效期和撤销机制，不能恢复旧做法。

## 返回与使用

employeeCompanyAccess() 只在服务器运行。verified 返回公司身份信息，不授予业务 role，也不创建成员或管理员。/api/auth/company 只返回状态及 contentAccess=not_configured，不输出邮箱、用户 ID、Workspace ID 或令牌；所有响应 private,no-store。

- 无会话 401；配置未完成或供应商故障 503；身份/Workspace 不符合 403；公司校验成功 200。
- Slack 令牌撤销/失效及已知访问拒绝：denied。临时故障、限流、Workspace 迁移与未知应用级错误：unavailable；两者均不能读取资料。
- 员工页面显示公司验证未配置、未通过或已通过但资料库仍未开通。退出按钮保留。服务故障进入既有登录恢复页。
- applicationAuthorization 仍关闭；T014/T015 接入管理员检查、角色及成员/受限数据库后才能授予实际阅读权限。当前 API 成功不等于可读文章。

## 测试项目准备步骤（待执行）

- 用户提供准确邮箱域名和 Workspace ID 后，将其放入本地安全配置。多个域名用英文逗号分隔，无 @、URL 或通配符。
- 在指定 Clerk 测试实例启用标准 Slack social connection，使用现有官方 SignIn 流程；需要用户通过 Slack 授权并获得 openid、profile、email 所需身份信息。本轮不支持旧站自定义 oauth_custom 连接。
- 实测 Clerk externalAccountId、providerUserId、verification 和 Slack sub/team/email 字段及令牌刷新。若格式不同，应基于真实可信字段修正映射；不能放宽为只信任 metadata。
- 验收正确/错误 Workspace、未验证或外部邮箱、同公司不同人邮箱、不完整 scopes、账号禁用、Slack 撤销、回调取消、断网及限流。管理员确认过的合格账号也要走同一校验。
- 当前逐次调用 Slack；正式部署前需结合配额与访问量验收性能及限流处理，不声称已完成高并发验证。

参考：[Clerk Slack 连接](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/slack)、[Slack userInfo 返回与错误](https://docs.slack.dev/reference/methods/openid.connect.userInfo/)。实现另核对已安装 Clerk 7.9.1 类型。旧 site 的 lib/clerk-server.ts 仅用于比较；本轮独立编写，不修改旧站、不复制凭据或旧逻辑。
