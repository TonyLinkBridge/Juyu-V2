# Developers 上线前验收 · 2026-10-03

用户已批准完成数据库更新、推送 main、部署与正式后台验收。本文记录提交前已完成的验证；部署回执和浏览器截图另保存至本地忽略目录 `output/verification/`。

## 提交前检查

- 基础提交：`c121db47afa28a3e6c4e711a1cafc0f2d12c6cb5`，保留已上线的分类显示。
- Node.js 24.19.0：`npm run verify:build` 通过。567 单元测试、类型检查、生产构建与 CSS/浏览器资源检查通过；Lint 0 errors，原有测试夹具保留 1 warning。
- authorization、publication、slack-notifications、developers 隔离 PostgreSQL 回归：89/89 通过。
- `npm run test:critical`：266/266 桌面、手机浏览器测试通过，包括 Developers 页面。
- 独立上线复核：无剩余 Critical / Important；Developers 专项单元 7/7 通过。

## 数据库启用

生产 Supabase 项目 `zscxaqjqjoouiolkoxbi` 已从 `0055_analytics_visible_time` 迁至 `0056_developers`。迁移事务成功，源码 checksum 与生产记录一致，未改写既有文章、分类、成员角色或通知送达状态。

迁移前已建立本地 `juyu` 数据库快照，归档目录权限 0700、文件权限 0600；核对归档目录表与 SHA-256。备份属于数据库快照，未备份 Storage 字节，也没有执行生产恢复。存储文件不受本次增量迁移影响。

使用正式受限数据库连接验证四类 Developers 数据读取与权限：Super Admin 可以读取；现有普通 Admin 的 Slack outbox RLS 读取为 0，使用已降级身份声明 Super Admin 的权限检查被拒绝。此项是数据库授权验证，不代替浏览器真实账号验收。

检查时现有 Slack outbox 共 18 条，18 条已送达，0 条失败。因此未创建测试通知或重发已送达通知；真实失败重试暂时没有可用样本，竞争条件及幂等逻辑已在隔离数据库和浏览器夹具中验证。

## 功能边界

四页只对有效 Super Admin 开放。API Keys 展示既有服务配置状态与有限连接检查，不显示密钥、不创建对外 API Key。Webhooks 管理现有 Slack 通知投递。Events / Logs 汇集应用已采集的安全日志，不是完整 Vercel 日志镜像。新增技术日志从启用后开始采集，旧请求不能补回。
