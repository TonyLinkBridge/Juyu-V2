# GitBook 功能迁移：正式 Supabase 执行记录

- 日期：2026-09-20（UTC）
- 项目：`zscxaqjqjoouiolkoxbi`
- 应用代码：GitHub 分支 `codex/gitbook-parity-20260920`，提交 `cf10d86`；尚未合并 `main` 或部署正式站。
- 执行前：迁移记录 30 项，最后为 `0030_publication_number`。已有 24 篇资料，其中 2 篇已发布；17 个 ready 状态的私有附件，共 2,731,991 字节。
- 备份：在同一个只读快照及短暂写锁下导出 `juyu` schema 自定义格式 archive，并下载全部 17 个私有附件。排除临时 `request_contexts` 表数据。备份及 manifest 保存在本机忽略目录 `output/verification/pre-gitbook-migration/`，不是 GitHub 文件，也不是异地加密备份。archive SHA-256：`d2fc2ba2c334e3f208b18add6cf6e12a13fbf5c40ee32fb408bfb886aa26364c`；本机读回校验通过，17 个附件合计 2,731,991 字节。
- 执行：由 `migrate()` 在单一事务中依序应用 `0031_scoped_search` 至 `0040_document_locales`，全部成功。
- 执行后：迁移记录 40 项，最后为 `0040_document_locales`；仍有 24 篇资料、2 篇已发布及 17 个 ready 附件。原资料均为 `zh-CN`，暂无英文正式稿。新增语言与搜索函数授予 `juyu_runtime` 执行权限，语言函数未向 PUBLIC 开放。
- 正式域名 `/api/health?release` 返回 `ok`、`web_process_only`，只证明网站进程响应。真实 Support、OPS、Admin 登录后的业务验收以及正式应用部署尚未完成。
