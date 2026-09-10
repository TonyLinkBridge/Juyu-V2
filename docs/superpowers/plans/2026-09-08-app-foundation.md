# Next.js 前后台工程 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 完成 T007：可启动、可构建的网站基础及未连接状态，不冒充认证和数据已接通。

**Architecture:** 在现有 TypeScript 工程增加 Next.js App Router；`src/domain` 保持独立。公开入口只有导航和服务未连接说明，员工资料路径与后台路径重定向至各自登录入口。配置报告仅输出存在/缺失/格式状态，不输出密钥；配置齐全也不等于服务已集成。

**Tech Stack:** Next.js 16.3.1、React 19.2.8、TypeScript 5.9.3、Tailwind 4.2.1，Node 原生测试及 Playwright。版本取自本机提供的 site 已安装包，依赖清单不整包照搬。

**Spec:** `TASKS.md` T007，`docs/TECH_STACK.md`。UI 的本阶段交付是入口页，不是 GitBook/Tasks 已移植页面。

## Global Constraints

- 第一版不接 Liveblocks。
- 不读取或复制任何旧项目 `.env`、密钥或会话。
- 没有 mock 登录、默认 Admin 或绕过授权的预览开关。
- 缺少真实认证与数据库接入时，readiness 必须 503；health 仅表示进程存活。
- 本目录是独立 V2 项目且无 Git 仓库；不改三个来源目录，不创建额外 worktree。

## 文件与接口

- `package.json`、`package-lock.json`、`tsconfig.json`、`next.config.ts`、`postcss.config.mjs`、`eslint.config.mjs`：应用和检查配置。
- `src/config/readiness.ts`：`inspectConfiguration(env: Record<string, string | undefined>)` 返回 `{state, missing, invalid}`；`getReadinessReport(env)` 返回不含配置值的未就绪报告。
- `src/app/layout.tsx`、`globals.css`、`page.tsx`：共用布局、样式和入口。
- `src/components/entry-shell.tsx`、`access-unavailable.tsx`：页面框架、未连接说明。
- `src/app/help-centre/page.tsx` 和 `src/app/admin/page.tsx`：重定向到 `/sign-in`、`/admin/sign-in`。
- `src/app/sign-in/page.tsx` 和 `src/app/admin/sign-in/page.tsx`：不同入口，共用诚实的未连接状态。
- `src/app/api/health/route.ts`：200 仅报告进程存活。
- `src/app/api/readiness/route.ts`：503、no-store，配置填写完整也不能冒充服务已连接。
- `src/app/not-found.tsx`、`src/app/error.tsx`：返回入口、重试；不展示异常详情。
- `.env.example`：只列空配置项及解释，不包含可用凭据。
- `tests/readiness.test.ts`、`tests/e2e/foundation.spec.ts`、`playwright.config.ts`：配置和实际页面验收。

## Task 1 · 配置边界

- [x] 先写测试和拒绝默认值的函数签名，运行失败后补实现。验证缺失项、错误域名/URL/Slack ID、配置齐全仍未集成、输出不含配置值。

```ts
assert.equal(inspectConfiguration({}).state, 'missing');
assert.equal(getReadinessReport(validFixture).status, 'not_ready');
assert.equal(getReadinessReport(validFixture).authentication, 'not_integrated');
assert.equal(JSON.stringify(getReadinessReport(validFixture)).includes(validFixture.CLERK_SECRET_KEY), false);
```

- [x] 格式校验仅接受精确公司域名列表、https Supabase origin（本地开发可用 loopback HTTP）、Slack T 开头大写标识；Clerk pub/secret 前缀及 test/live 配对。Supabase key 存在仅表示已填写，不能推断有效。
- [x] 运行配置测试与现有规则测试。

## Task 2 · 工程和页面

- [x] 安装锁定依赖，保留现有测试命令；增加 dev/build/start/lint/typecheck/test:e2e 脚本。
- [x] 先定义浏览器验收：访问 `/` 可走到员工和后台入口；直接访问 `/admin?role=admin` 仍去后台未连接页面；没有可点击的模拟登录；未知路径 404 可返回；手机不横向溢出；readiness 不缓存且返回 503。
- [x] 建立上述页面与共用样式。页面用中文、系统字体、克制红色品牌元素；未登录无文章正文、名单和草稿数据。
- [x] 运行 build、lint、typecheck；修复后启动 production server 验证真实路由。

## Task 3 · 浏览器与收尾

- [x] 使用 Playwright 在桌面 1440×1000 和手机 390×844 检查入口跳转、键盘、未连接状态及宽度；输出真实截图到 `output/verification/`。
- [x] 检查 HTTP health=200、readiness=503、资料和后台重定向、404、无敏感值输出。
- [x] 独立代码审查后完成验收记录，更新 T007 和 README；其他登录、数据和 UI 移植任务不勾选。
