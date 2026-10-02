# 开发者工具

仅开放给当前已验证且未禁用的 Super Admin。侧边栏按服务端成员角色显示；每个页面、API 和数据库读取仍各自校验权限。普通 Admin 无法通过直接输入地址或伪造请求头进入。

## 四个页面

| 页面 | 当前范围 |
| --- | --- |
| `/admin/developers/overview` | 现有服务状态；已采集请求数量、异常和平均响应；通知总数与最近事件。 |
| `/admin/developers/api-keys` | Clerk、数据库、私密文件、Slack、Cron 的配置是否填写及有限连接检查。不会显示、复制或编辑密钥，也不创建 JUYU 对外 API Key。 |
| `/admin/developers/webhooks` | 现有 Slack 发送队列、筛选和失败重试。不会创建任意外部接收地址。 |
| `/admin/developers/events-logs` | 文章审核历史、Slack 发送状态、技术请求、连接检查、发布按钮诊断及手动重试记录。支持期间、来源、等级、文字筛选和分页。 |

连接检查的边界：Clerk 只验证公开签名密钥；数据库验证受限角色与核心结构；文件检查 `juyu-private` 是私密桶；Slack `auth.test` 检查 Bot 身份和批准工作区，不发送测试消息，亦不能证明频道投递成功。Cron 配置存在不能证明 Vercel 已执行定时任务。结果附检查时间，旧结果不是实时健康保证。

## 上线顺序

1. 备份数据库。使用现有安全方式准备 `.env.local` 中的迁移管理员凭据、TLS CA 和项目配置。运行 `npm run db:migrate:developers` 仅检查当前迁移状态，不修改数据库。
2. 确认最新版本为 `0055_analytics_visible_time` 后，执行 `npm run db:migrate:developers -- --apply`。脚本只允许新增 `0056_developers`，在事务内安装记录表、RLS 与重试函数；不会在网站启动或访问页面时自动迁移。
3. 部署代码。Vercel 的 `JUYU_DEVELOPER_LOGGING=true` 已在配置中声明，本地通过环境变量选择开启。沿用原有 Slack 配置及 `/api/cron/slack-notifications` 定时任务，不额外申请 Slack 权限。
4. 使用真实 Super Admin 验证四页，普通 Admin 验证拒绝访问；测试一次已有失败通知的重试并确认 Slack 实际送达。界面测试夹具不能代替这一步。

数据库未迁移时，日志页显示 `0056` 待启用，现有文章、图片和发布接口仍保留原来的响应行为。记录失败不会把成功发布改成失败。

## 统计与记录边界

- 请求统计只覆盖 `/api/assets/[id]`、文章 PDF 与发布 POST。按马来西亚日历最近 7 或 30 天计数。4xx/5xx 都算异常；不是完整网站访问量，也不包括图片传输后的阅读时间。
- 使用现有受限连接池，响应完成后合并最多 100 条技术记录；记录服务失败暂停一分钟。属于尽力采集，极端负载或实例中断可能丢记录，不作为完整计费或安全审计依据。
- 发布按钮诊断只保存白名单阶段、原因、在线状态、草稿序号和尝试编号；员工与文章归属由已验证服务器身份补充。不会保存正文、请求体、查询字符串、密钥值或服务商原始错误。
- 定时任务每次最多清理 2,000 条超过 30 天的技术记录。依赖 Cron 正常执行；积压清理可能需多次运行。文章审核历史不清理，手动重试回执保留以防重复安排。
- 手动重试仅重新安排已失败、未发送、未被发送进程占用的通知，使用操作 UUID 保证重复确认幂等。并发状态改变会返回冲突。安排成功与送达成功分别显示。
- Slack 在网络不确定时的“是否曾成功送达”仍由原有发送队列处理；该页面不承诺跨 Slack 与数据库的绝对一次送达。

## 本地检查

```sh
npm run typecheck
npm run lint
npm test
node --experimental-strip-types --test tests/database/developers.test.ts
npm run build
npx playwright test tests/e2e/developers.spec.ts
```

GitHub 的 Verify 工作流会运行开发者页面的桌面/手机测试和独立 PostgreSQL 开发者权限回归。浏览器测试使用明确标记的本地示例；数据库测试使用独立临时 PostgreSQL，验证真实受限角色、RLS、角色变更、禁用账号、筛选、指标、幂等重试、占用和保留策略。
