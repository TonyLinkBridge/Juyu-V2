# Developers 本地验收 · 2026-10-02

## 范围与状态

已实现 Overview、API Keys、Webhooks、Events / Logs 四页，映射 JUYU 当前服务、Slack 发送队列、文章审核与新增技术诊断。保留 JUYU 红灰样式；只开放给当前有效 Super Admin。

当前为本地代码与隔离测试验收。尚未提交、推送、部署或执行生产迁移 0056；没有申请新服务权限、创建对外 API Key、连接新账号或发送真实 Slack 测试通知。生产启用顺序见[开发者接入说明](../setup/developers.md)。

## 验证结果

Node.js：24.19.0。基础提交：6be760ec192bea6a4ea52b13f4dcb0abcd0128ca。

| 检查 | 结果与边界 |
| --- | --- |
| `npm run verify:build` | 567 单元测试通过；类型检查、生产构建、内置 CSS 与浏览器资源追踪检查通过。Lint 为 0 errors，原有 fixture-typescript-loader 保留 1 条匿名默认导出 warning。 |
| 独立 PostgreSQL 回归 | authorization、publication、slack-notifications、developers 共 89 项通过。临时数据库，不使用生产连接。 |
| Developers 数据库专项最终复验 | 5 项通过；真实受限角色、RLS、旧 Super Admin 身份降级、禁用、错误脱敏、幂等回执、发送占用、30 天清理及两连接池并发写入。 |
| 桌面/手机专项 | developers、reader-frame、media-library、publication 共 64 项通过。 |
| 最终样式复验 | 类型检查、Lint、生产构建通过；Developers 桌面/手机 8 项通过。 |
| `npm run test:critical` | 含新增 Developers 页面，共 266 项通过，覆盖编辑器、收藏、登录边界、OPS、Reference、Q&A、媒体与后台核心流程。 |
| 内置浏览器 | 验收四页、连接检查反馈、键盘重试确认、事件来源/等级/文字筛选、详情与正确文章链接；检查 1440px 桌面与 390px 手机显示。全部使用清楚标记的本地示例，不代替真实账号和 Slack 送达验收。 |
| 独立代码复核 | 首轮发现 5 个 Important，修复后复核无剩余 Critical / Important。 |
| 工作树 | `git diff --check` 通过；修改保留供审阅，未推送。 |

本地日志与自动截图在忽略目录 `output/verification/`；内置浏览器截图为 `juyu-developers-*-20261002.png`，示例身份、请求数及通知数不能视为生产数据。

## 关键回归覆盖

- 导航展示、页面授权、API 授权与数据库校验各自执行；普通 Admin、禁用或降级账号不能取得记录。
- 连接检查先释放身份校验的数据库 scope，再借 worker 连接保存结果。两个检查并发不会相互等待第三条池连接。
- 手动重试只操作已失败且未发送、未被占用的通知；同一 UUID 保留确认结果，issuer 不能删除 operator 回执。
- 未识别的供应商错误转换为固定失败代码，不将原始 vendor message 发到浏览器。技术记录只接受白名单元数据。
- 重试收到 `200 {}` 等不完整回执时显示“无法确认”，保留 UUID；不声称已经安排。
- 事件详情使用 `/admin/editor?article=...`，并支持安全检查代码、阻止原因和尝试编号的文字查找。
- 记录失败不改变原有接口结果；新请求指标只涵盖图片/附件、PDF 与发布 POST，不能代表全站流量。旧技术记录无法补回。

## 原有测试维护

ReaderFrame 的 4 个旧失败在基础提交的组件夹具中同样复现，属于自定义主题切换器迁至官方 Fumadocs ThemeSwitch 后的过时断言。夹具加入实际 next-themes Provider，断言改为官方按钮与 `.dark`；产品主题组件没有改动。临时基础对照测试已删除。

## 自动检查与生产待办

GitHub Verify 现在将 Developers 桌面/手机测试纳入 `test:critical`，另运行独立 PostgreSQL 开发者权限回归。本次没有触发云端工作流。

上线时需先按接入说明执行数据库迁移 0056，再部署；随后用真实 Super Admin 和普通 Admin 验证权限、连接检查与日志，并对已有失败通知确认 Slack 实际送达。技术采集与清理依赖已配置的 Vercel 环境和 Cron；本地通过不能证明这些生产条件已完成。
