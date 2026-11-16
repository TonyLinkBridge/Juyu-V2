# 二审批准并发布验收

## 变更
- 知识文章、OPS、Reference、Q&A 共用三种操作：批准并发布、仅批准稍后发布、退回修改。
- approve_publish 在既有 ScopedDatabase 单次事务里执行 approve、queue、publish，保留标准独立二审凭据及三个既有审计事件。不使用 Super Admin 自审通道。
- 文件检查、角色有效性、指定审核人、作者/编辑不能自审、版本并发检查沿用原规则。没有数据库迁移或新依赖。
- 丢失响应只能重试原决定，回执同时核对正式版指针、送审版本、审核人及三步序列。已经提交的重试不重复发布或生成通知。
- 英文稿两种批准都要求质量确认；原 approve/reject 请求继续兼容。

## 已完成检查
- npm run verify:build：类型、规范、617 项单元、正式构建及构建后样式/浏览器检查通过。保留原有 fixture-typescript-loader 匿名默认导出警告，没有新增规范错误。
- npm run test:db：485 项通过，包括普通发布、四类组合发布、独立审核权限、并发重试、英文确认、失败原子回滚及旧正式版/历史保留。
- 二审浏览器专项：62 项桌面/手机检查通过，包括仅批准和退回、四类一次确认发布、英语确认、断线重试及返回正确管理模块。
- 内置浏览器连接自建临时 PostgreSQL：article、ops、reference、qa 均为 published/standard，历史均为 create→submit→approve→queue→publish；qa-later 为 approved 且无正式版，qa-return 为 changes_requested 且原因完整保留。
- 组合发布时挂起上传、最后 publish SQL 错误均回滚审核凭据、流程、正式版指针、审计及 Slack outbox。
- 两个原有未提交文件 AGENTS.md、account-clerk.ts 的校验值保持不变，不纳入此次提交。

上一版 Verify（43795598199）已耗时约 28 分钟，其中关键浏览器检查约 19.5 分钟。本次增加 62 项二审检查，因此 quality 时限从 30 分钟调整到 35 分钟；所有检查及失败条件保留。

## 完整关键浏览器回归
- npm run test:critical：454 项全部通过（10.2 分钟），包含桌面/手机端二审、编辑、文件、权限、OPS、Reference、Q&A 等既有流程。
- 已将 decision.spec.ts 纳入每次 Verify 的必跑检查。

## 发布
本记录在推送之前完成；本地验收全部通过后，按用户授权推 main。远端自动检查及部署结果需独立查看，不将本地测试描述为生产发布验收。

## 范围
真实草稿、文章发布状态、生产数据库及 Slack 消息均未操作。浏览器实际审批仅发生在测试自建数据库。生产验证不得以批准真实内容来测试。
