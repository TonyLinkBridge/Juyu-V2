<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/brand/juyu-logo-white.png">
  <img src="public/brand/juyu-logo-color.png" alt="聚域 JUYU" width="176">
</picture>

# JUYU Help Centre

**为团队保存可靠的答案。**

聚域内部资料库，集中管理团队知识、运营流程、业务速查与标准问答。员工查阅已发布资料，管理员编辑、审核与维护内容。

仅限经授权的公司成员访问。

[主要功能](#主要功能) · [快速开始](#快速开始) · [技术分工](#技术分工) · [权限与发布](#权限与发布) · [检查与部署](#检查与部署) · [项目结构](#项目结构) · [文档导航](#文档导航)

> 本文说明当前代码的功能与维护方式。代码实现、本地检查、生产部署、数据库迁移和真实账号验收分别记录；具体范围以对应的[验收记录](docs/verification/)为准。

## 主要功能

| 功能 | 用途 |
| --- | --- |
| 资料阅读 | 知识文章、OPS、Reference、Q&A；按权限浏览目录、搜索和阅读已发布内容，使用收藏、最近浏览与文章反馈。 |
| 内容工作台 | BlockNote 编辑、草稿保存与预览、审核发布、版本历史和内容恢复。 |
| 分类与权限 | 管理成员、阅读范围、文章分类、目录顺序及导航设置。 |
| 媒体文件 | 上传、查找和预览私有文件，查看文件关联的文章。 |
| 使用分析 | 查看资料打开情况、搜索表现与员工阅读明细；历史未采集的停留时间显示为“未记录”。 |
| 开发者工具 | Super Admin 查看服务配置、连接检查、Slack 投递与集中日志；启用依赖迁移 0056。 |
| Slack 通知 | 提交、审核、发布与更新通知；实际送达依赖工作区授权、频道配置、数据库迁移和重试任务。 |

“平均可见停留”表示页面在前台可见的时间，不能证明员工读完或理解了资料。统计口径见[使用分析说明](docs/setup/analytics-visible-time.md)。

## 快速开始

使用 [`.nvmrc`](.nvmrc) 指定的 Node.js **24.19.0**。安装依赖、准备环境配置后启动网站：

```sh
nvm use
npm ci
test -f .env.local || cp .env.example .env.local

# 按接入指南填写配置后启动
npm run dev -- --port 3211
```

本地地址：<http://127.0.0.1:3211>。员工入口为 `/help-centre`，管理员入口为 `/admin`。

已有 `.env.local` 时保留原文件。模板不包含真实密钥；网站能启动不代表登录、数据库或私有文件服务已经接通。配置步骤见[本地启动与环境接入](docs/setup/local-development.md)。

## 技术分工

| 技术 | 负责什么 |
| --- | --- |
| Next.js · React | 组织页面、服务端读取和业务接口。 |
| Fumadocs UI · Core | 提供员工阅读端的官方布局与组件；通过 JUYU 适配层连接数据库内容、页面树和权限。 |
| BlockNote | 编辑结构化正文，保存内容块与格式。 |
| Clerk | 管理登录会话；服务端结合公司准入和成员记录执行访问控制。 |
| Supabase · PostgreSQL | 保存业务数据、版本和审核记录，存放私有文件。 |
| Vercel | 部署网站与服务端函数，运行已配置的通知重试任务。 |

文章内容保存在数据库中，不使用 Fumadocs MDX 文件作为内容来源。Fumadocs 负责阅读界面，BlockNote 负责写作界面，审核和权限由 JUYU 服务端执行。详细说明见[技术分工](docs/TECH_STACK.md)。

## 权限与发布

- 四种角色：Support（客服）、Ops（运营）、Admin（管理员）、Super Admin（超级管理员）。阅读范围由服务端校验。
- 员工读取当前正式版本；工作草稿通过受保护的管理入口预览，编辑不会直接覆盖正式版。
- 普通审核流程区分作者与二审者；Super Admin 可直接批准并发布自己最后保存的符合条件版本。
- 保存与发布校验版本；发生冲突时保留输入，避免覆盖他人修改。
- 图片、附件和 PDF 按资料权限访问。文件所属资料与版本由服务端核对，不能信任浏览器自报的权限或归属。

## 检查与部署

代码质量与构建检查：

```sh
npm run verify:build
```

核心浏览器检查（先完成构建，保持本机 `3210` 端口空闲）：

```sh
npx playwright install chromium
npm run test:critical
```

已发布资料链接检查（需要已迁移数据库和有效管理员 ID）：

```sh
npm run validate:links
```

浏览器检查使用本地测试夹具，不能代替真实账号验收；资料链接检查只读当前管理员有权读取的正式内容。数据库、PDF、全量浏览器、恢复演练及自动检查的前置条件见[检查与部署指南](docs/setup/verification-and-deployment.md)。

GitHub [Verify](.github/workflows/verify.yml) 在拉取请求和 `main` 推送时运行质量、构建与核心浏览器检查。独立的[资料链接检查](.github/workflows/validate-links.yml)在 `main` 的推送校验成功后、每天 09:00（Asia/Kuala_Lumpur）及手动触发时运行。

[Vercel 配置](vercel.json)使用 `npm run verify:build` 构建。推送成功或部署 Ready 都不能代替上线后的真实登录、审核发布、文件访问、PDF 和 Slack 通知验收。

## 项目结构

```text
src/       页面、组件与业务逻辑
public/    Logo 与静态资源
scripts/   检查、迁移和维护工具
tests/     单元、数据库与浏览器测试
docs/      项目说明、设计和验收记录
fonts/     PDF 与流程图使用的中文字体
.github/   自动检查工作流
```

`.next/`、`node_modules/` 和 `output/` 为本机生成目录，不属于提交的源码。`.env.local` 等真实环境配置不进入仓库。

## 文档导航

| 入口 | 内容 |
| --- | --- |
| [本地启动与环境接入](docs/setup/local-development.md) | 环境变量、登录、数据库与私有存储前置条件。 |
| [检查与部署](docs/setup/verification-and-deployment.md) | 检查命令、CI、部署顺序与上线验收。 |
| [开发者工具](docs/setup/developers.md) | 四个开发者页面、权限、连接检查边界和迁移顺序。 |
| [Slack 通知](docs/setup/slack-notifications.md) | Bot 权限、频道配置、通知队列与重试。 |
| [使用分析](docs/setup/analytics-visible-time.md) | 可见停留统计口径与迁移要求。 |
| [备份与恢复](docs/setup/T060-backup-recovery.md) | 数据库、文件备份与恢复演练。 |
| [项目任务](docs/project/TASKS.md) | 任务范围、阶段进度和验收条件。 |
| [设计与体验](docs/design/) | 阅读端和管理工作台的设计记录。 |
| [验收记录](docs/verification/) | 历次检查结果及仍待验证的范围。 |
| [来源与许可](docs/sources/README.md) | 组件来源、移植记录和许可证。 |

<details>
<summary>历史开发记录</summary>

早期阶段进度、测试数量及当时的限制保存在[旧 README 归档](docs/project/readme-history.md)。它是历史快照，不作为当前部署状态或功能完成度的说明。

</details>
