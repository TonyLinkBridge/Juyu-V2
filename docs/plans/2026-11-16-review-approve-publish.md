# 二审批准并发布 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline and verify each step before continuing.

**Goal:** 指定独立审核人可一次确认批准并发布，保留仅批准稍后发布和退回修改。

**Architecture:** 在现有 ScopedDatabase 事务内复用 approve、queue、publish 三个既有转换；任一步失败全部回滚。继续保存三个连续审计事件、标准二审凭据和既有通知，避免引入 Super Admin 自审通道或新数据库状态。

**Tech Stack:** TypeScript, Next.js, React, PostgreSQL, existing pg transaction/RLS boundaries.

**Spec:** 以下 Design，来自用户已确认的二审操作方案。

## Design
- 四类内容共用二审页。主要按钮“批准并发布”，次要按钮“仅批准，稍后发布”，保留“退回修改”。
- 两种批准都需明确确认；英文稿继续要求英语质量确认。
- 新 API action approve_publish；准确回执必须匹配文档、指定审核人、版本、原序列加三、正式版指针。原 approve/reject 保持兼容。
- 原子事务复用既有文件、权限、版本冲突和发布检查。超时只能重试原决定，已提交的重试不得重复生成版本、发布或通知。
- 不改正文、权限、URL、真实草稿及真实发布状态；不新增依赖、数据库迁移或生产数据操作。

## Review Focus
- 作者、非指定管理员、停用账号和普通员工仍不可批准。
- 文件未就绪或最后发布失败，审核、队列、正式版和通知均保持原样。
- 重复点击、并发和响应丢失不能重复发布。
- 旧正式版及历史保留；原链接沿用既有发布通道。
- 普通批准与退回不受新增组合操作影响。

## Tasks
- [x] 添加合同/客户端和独立数据库测试，观察新增操作失败。
- [x] 实现事务组合与准确重试回执；运行数据库权限、原子性、历史和通知检查。
- [x] 调整二审 UI、确认与错误提示；用四类模拟资料验证桌面/手机、仅批准、退回和断网重试。
- [x] 完整单元/数据库检查、类型/规范、构建；内置浏览器确认。
- 发布步骤：只提交本次文件并推 main，核对远端提交。
