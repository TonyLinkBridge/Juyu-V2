# JUYU Help Centre · 技术分工

本文描述当前仓库的技术职责。依赖版本以根目录 [package.json](../package.json)与 [package-lock.json](../package-lock.json)为准；本地实现、部署和真实服务验收分别记录。

| 技术 | 白话分工 |
| --- | --- |
| React · Next.js | 制作员工与管理员界面，组织路由、服务端读取及业务接口。前台和后台在同一工程中。 |
| TypeScript | 定义业务数据和接口类型，提前检查类型错误。 |
| Tailwind CSS · 应用样式 | 管理 JUYU 颜色、间距、深浅主题及电脑/手机排版，加载组件所需样式。 |
| Fumadocs UI · Core | 员工阅读端的官方布局、页面与富内容组件；JUYU 将数据库资料、页面树和权限接入阅读端。 |
| BlockNote | 管理员编辑结构化正文、标题和内容块；草稿与正式阅读分别使用对应的编辑/展示层。 |
| Supabase · PostgreSQL | 保存文章、不可变版本、审核、成员、配置、收藏与分析数据，私有 Storage 保存图片和文件。 |
| Clerk | 登录、退出和身份会话；JUYU 服务端继续校验公司邮箱、Slack Workspace 和当前成员权限。 |
| Vercel | 网站、服务端函数与通知重试任务的部署环境；具体构建和计划见 [vercel.json](../vercel.json)。 |
| Node.js | 网站服务端和开发工具运行环境；指定版本见 [.nvmrc](../.nvmrc)。 |
| KaTeX · Mermaid · Shiki | 数学公式、流程图和代码高亮。 |
| Playwright · Chromium | 浏览器检查，以及服务器上的 PDF/流程图渲染；本机与云端运行条件需分别验证。 |

## 阅读与编辑

Fumadocs 提供阅读端组件，BlockNote 提供写作编辑器；两者不是同一个编辑系统。JUYU 的适配代码负责把数据库中的内容块和元数据交给阅读组件，并保持预览、正式版本与权限规则一致。

当前未安装 Fumadocs MDX 包，不使用 Markdown/MDX 文件目录作为文章内容来源。使用官方组件不等于由 Fumadocs 代管数据库、审核流程或业务授权。

早期 GitBook 和 Square UI Tasks 的来源、移植记录与许可仍完整保存在[来源记录](sources/README.md)中；它们不作为当前阅读端技术名称。

## 服务端与权限

Clerk 提供已验证的会话身份。服务端检查公司准入、当前成员和角色，再通过受限数据库连接执行资料读取与工作流操作。在前端隐藏按钮不能代替授权。

Support、Ops、Admin、Super Admin 四种角色及实际访问规则见[项目 README](../README.md#权限与发布)。服务端核对文件所属资料和版本后才读取私有对象；浏览器不能自报角色、已验证状态或附件归属来获得访问。

## 版本与保存

BlockNote 内容经过验证后保存为版本快照。工作草稿与当前正式版本分离；保存、审核与发布通过版本校验和受控事务保护并发修改。发生冲突时保留输入，不能无提示覆盖他人的版本。

当前不使用 Liveblocks；版本校验不等同于多人实时光标和协同编辑。

## 检查与上线

embedded-postgres 只用于一次性本地数据库测试，不是上线数据库。测试夹具不是公司真实账号或业务内容。数据库迁移不会在网页请求或应用启动中自动执行。

配置、检查和部署步骤见[本地接入](setup/local-development.md)与[检查部署指南](setup/verification-and-deployment.md)。真实服务是否可用应根据目标环境的[验收记录](verification/)判断，不能根据依赖已安装或本机构建通过推定。
