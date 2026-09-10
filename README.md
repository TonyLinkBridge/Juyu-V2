# Juyu V2

内部资料库，员工端沿用指定 GitBook 源码，管理员端沿用 Tasks 工作台方向；Clerk 管理身份，Supabase 管理业务数据及私有附件，BlockNote 用于内容编辑。第一版不接 Liveblocks，采用版本校验保护并发保存，防止互相覆盖。

## 测试环境接入（T059）

用户现选择 Clerk Production，GitHub 仓库地址已提供，正式域名尚未确定且 Vercel 项目尚未建立。已修复邮箱域名分隔格式；正式配置使用 `npm run check:config -- --clerk-production`，工具不联网、不输出密钥、不执行初始化。详见 [当前正式环境接入说明](docs/setup/T059-clerk-production.md)；[测试路线](docs/setup/T059-test-environment.md)保留可用。下面的早期进度描述以 TASKS.md 与此指南为准。

## 当前可以做什么

- 查看 `TASKS.md` 的 63 项任务（包含文件夹改名）及验收条件。
- 查看 `output/design/` 的前后台桌面视觉稿。
- 启动 Next.js 网站，查看入口、员工登录入口和管理员登录入口。
- 执行权限、审核、配置检查和桌面/手机浏览器测试。
- 在一次性本地 PostgreSQL 中验证数据库迁移、版本保存、审核发布、并发冲突和故障回退。

当前已本地实现网站基础、登录入口、受保护成员管理、GitBook派生阅读及富内容、文章反馈、Tasks内容工作台、BlockNote编辑、指定二审与发布、历史恢复及OPS专区。统一标题/标签/正文搜索，Reference正式速查表、列/关键词筛选，以及Q&A正式问题列表、分类/排序和管理员审核编辑入口已完成本地验收，个人收藏、独立保存/取消及权限过滤列表也已完成本地验收；真实账号跨设备读取待配置后验证。最近浏览也已本地验收：每人最多100篇，只在实际打开正式阅读区后记录，列表按当前权限读取。搜索、浏览、结果点击和反馈采集已本地验收；暂不保存搜索词原文；管理员使用分析后台也已本地验收，可按7/30/90天查看指纹分组、零结果、点击率、热门正式资料和当前版本负反馈。具体关键词、真实账号/运营数据联合验收仍待配置。自定义字段设置已本地验收，支持五种类型、必填/选项/启停，字段快照随文章版本保存并显示在审核、阅读、历史和PDF中；下一项为分类设置。具体进度见TASKS.md。Clerk SDK 已完成本地接入，真实测试项目尚未配置；公司账号校验和成员权限已完成本地实现，真实联合验收待办。没有可用的模拟登录；测试中的账号及文章均是本地夹具，不是真实业务数据。

## 本地检查

要求 Node 22.18–24.x。本次在 Node 24.19.0 验证。

```sh
nvm use
npm ci --ignore-scripts
npm run dev -- --port 3211
# 另一个终端中执行检查
npm test
npm run lint
npm run typecheck
npm run build
npm run test:pdf
npm run test:e2e
```

单元测试使用 Node 原生测试功能。Playwright 使用 production build 在 3210 端口启动临时服务，验收完成后关闭；首次环境若没有 Chromium，可使用 `npx playwright install chromium` 安装。

浏览器打开 `http://127.0.0.1:3211`。打开根地址 `/` 或 `/help-centre` 直接进入员工登录入口，不再显示双入口选择；`/admin` 保留独立管理员登录入口；两者当前均明确显示尚未连接。`/api/health` 仅检查网站进程存活，`/api/readiness` 在真实认证与数据库未接入时保持 503。配置格式正确也不等于服务就绪。

## 已实现的规则

- `src/domain/access.ts`：只接受三个角色；未通过公司验证或未知身份被拒绝；员工读取当前正式版本；搜索内容投影与附件版本授权使用相同规则。
- `src/domain/workflow.ts`：创建、编辑、指定二审、撤回、换二审、退回、批准、安排发布、发布；不能自审或越级发布。
- `src/domain/model.ts`：工作版本和正式版本分离，每次编辑保存新快照，操作生成历史；已批准内容修改后重新审核。

## 集成时必须保持的边界

1. `Viewer` 只能由可信服务端在验证 Clerk、公司邮箱、Slack Workspace 后构造；不能把浏览器传来的 role 或 companyVerified 直接交给规则函数。
2. 附件所属资料与版本从服务端存储记录读取，不能信任请求自报的 documentId/revisionId。T011 已实现私有存储适配器与下载接口，本地验收通过；真实私有桶及身份接入仍待配置和验收。
3. `sequence` 校验是并发控制的输入要求。`src/server/database/repository.ts` 已实现行锁和同一事务保存版本、审核、发布指针及审计；真实接口必须调用受控事务仓储，不能单独调用纯函数后随意写库。
4. 员工阅读仅返回当前已发布版本，Admin 草稿预览另设受保护入口。搜索投影函数不是搜索引擎。
5. 版本正文当前为字符串快照。BlockNote 接入时需增加结构化内容验证与转换，不能称作已支持完整编辑器。
6. 保存的草稿作者、当前编辑者和提交者不能成为该版本二审。已经退回的内容可编辑为新草稿后重提，审核结论不继承。

源目录仅作为后续迁移来源，当前没有修改，也没有复制其中的环境变量。源码许可与文件来源随实际 UI 移植在 T003 记录。

实施计划：`docs/superpowers/plans/2026-09-08-core-rules.md`。本地验收：`docs/verification/2026-09-08-core-rules.md`。

技术分工：`docs/TECH_STACK.md`。

源码来源与移植记录：`docs/sources/README.md`；阅读端 21 项源码对应表：`docs/sources/READER_FEATURES.md`。

T007 实施计划：`docs/superpowers/plans/2026-09-08-app-foundation.md`；验收记录：`docs/verification/2026-09-08-app-foundation.md`。本阶段入口 UI 为 JUYU 自编代码，不声称已移植 GitBook/Tasks。

T008 数据库说明和本地测试启动方式：`src/server/database/README.md`。数据库测试另运行 `npm run test:db`；若通过 `npm ci --ignore-scripts` 安装，需先按说明补全本平台 PostgreSQL 二进制链接。

T009 辅助数据表：`src/server/database/SUPPORTING_DATA.md`。新增表已纳入 `npm run test:db`，页面功能和实际访问授权仍按后续任务实施。

T010 本地授权层：`src/server/authorization/README.md`。支持按当前验证身份访问的受限数据库连接；两条文章 API 已接默认拒绝边界，真实 Clerk/Supabase 未配置时仍返回 503。

T011 私有附件及文件备份：`src/server/storage/README.md`；本地验收：`docs/verification/2026-09-08-private-files.md`。本地实际文件、Range、备份与恢复比对已通过；尚未连接 Supabase 测试项目，真实上传界面及云端验收未完成。

T012 员工登录/退出本地接入：`src/server/authentication/README.md`；验收记录：`docs/verification/2026-09-08-employee-login.md`。配置前仍显示未连接；真实 Clerk 登录/退出及公司权限验收待测试项目，业务资料访问继续关闭。

T013 公司邮箱与 Slack Workspace 本地校验：`src/server/authentication/COMPANY.md`；验收记录：`docs/verification/2026-09-08-company-access.md`。允许列表待用户提供，公司验证成功也不自动授予角色或放行资料；真实联合验收待办。

T014 独立后台入口与当前管理员检查：`src/server/authentication/ADMIN.md`；验收记录：`docs/verification/2026-09-08-admin-entry.md`。前后台共用 Clerk 会话；员工页只有管理员可见后台链接，后台页面/API 自行检查权限。单元 100/100、桌面/手机 20/20、构建/类型/lint 通过；真实账号联合验收待配置。管理员工作台仍为准备页，成员管理及业务身份绑定由 T015 继续。

T015 成员与角色管理：`src/server/members/README.md`；验收记录：`docs/verification/2026-09-08-members.md`。新增成员列表、Clerk 角色修改适配器、资料库停用/恢复、操作审计、异常核对和受限数据库身份绑定。单元 104/104、数据库 54/54、浏览器 26/26、构建/类型/lint 通过；真实账号和云端联合验收仍待配置。无模拟登录；成员界面测试使用独立浏览器夹具，未加入网站路由。下一项 T016 首位管理员引导。

T016 首位管理员和新成员开通：`src/server/enrollment/README.md`；验收记录：`docs/verification/2026-09-08-first-admin.md`。空系统首位合格无角色账号自动 Admin，后续新账号默认 Support；保留手工角色和已有系统，永久记录防止重新提权。前后台开通和错误核对已接入本地实现；真实服务联合验收待配置。单元 107/107、数据库 65/65、浏览器 36/36、构建/类型/lint 通过。下一项 T017 GitBook 左侧目录。


T017：GitBook 左侧平面文章目录已完成本地移植。六个来源文件及适配说明见 `docs/sources/T017-navigation.json`。目录只接收服务器核准的已发布标题，支持当前项高亮和长目录定位；正文、分组及手机抽屉仍按后续任务推进。110 项单元、68 项数据库、44 项浏览器验收通过，构建/类型/lint 通过。真实服务仍待配置，测试截图不是已上线资料库。验收：`docs/verification/2026-09-08-reader-navigation.md`。下一项 T018。


T018：多层分类目录已完成本地实现。使用 GitBook 分组组件，读取已保存分类顺序，保留稳定 ID；分类重命名、停用祖先、正式版本归属及多分类权限已验证。114 项单元、70 项数据库、48 项浏览器通过，构建/类型/lint 通过。详见 `docs/verification/2026-09-08-reader-groups.md`；真实 Clerk/Supabase 联合验收仍待配置。下一项 T019 正文与右侧小目录，分类管理控件属于 T049。


T019：基础正文阅读与本页目录已完成本地移植。当前文本快照支持标题、段落和基础列表；目录与正文从同一正式版本读取，支持重复标题定位、滚动高亮与刷新深链接。117 项单元、71 项数据库、54 项浏览器通过，构建/类型/lint 通过。详见 `docs/verification/2026-09-08-reader-body.md`；真实联合验收仍待 Clerk/Supabase 配置。下一项 T020 搜索框与结果页；富内容及 BlockNote 按后续任务推进。


T020：顶部搜索和标题结果页已完成本地实现。支持中文/英文标题词语匹配、高亮、计数和分页、键盘、空白/无结果/错误/等待状态。服务器只检索当前成员已授权的正式目录，草稿和无权分类不会进入结果。120项单元、72项数据库、70项浏览器通过，构建/类型/lint通过；搜索专项复验14/14。来源见 `docs/sources/T020-search.json`，验收见 `docs/verification/2026-09-08-reader-search.md`。真实服务未连接；正文/Reference/Q&A统一搜索属于T041。下一项T021：手机版目录菜单与自适应。


T021：手机版文章目录已改为可开关菜单，支持Escape/遮罩关闭、焦点循环、关闭后滚动恢复；宽屏保留左侧目录，断点切换重新定位当前文章。120项单元、84项浏览器检查、构建/类型/lint通过。宽表格仅完成容器排版验证，真实内容与设备验收仍待办。来源 `docs/sources/T021-mobile-navigation.json`，验收 `docs/verification/2026-09-08-mobile-navigation.md`。下一项T022：面包屑、上一篇/下一篇及回到顶部。


T022：面包屑、上一篇/下一篇、回到顶部已完成本地实现。按当前成员已授权正式目录生成分类路径与前后篇，首尾不循环；回顶尊重减少动画设置并恢复标题焦点。123项单元、73项数据库、90项浏览器及构建/类型/lint通过。来源 `docs/sources/T022-page-links.json`；验收 `docs/verification/2026-09-08-page-navigation.md`。真实服务和真机验收待办。下一项T023：深浅色模式、公告栏和页脚。


T023：浅色/跟随系统/深色主题及偏好记忆、可关闭的通用内部公告、GitBook 页脚已完成本地实现。公告按版本记忆关闭，仅在通过权限检查的阅读页显示；修复公告加载引起的目录末项裁切。123项单元、106项浏览器、构建/类型/lint通过。来源 `docs/sources/T023-presentation.json`，验收 `docs/verification/2026-09-08-reader-presentation.md`。后台公告管理见T054；真实 Clerk 组件、身份/服务联合验收及真机待配置。下一项T024：文章封面和标签。


T024：封面与标签的本地阅读及版本保存完成。沿用GitBook封面/标签结构，普通编辑保留元数据、分类和其他附件；二审发布后替换，封面通过私有附件权限读取。125项规则、77项数据库、112项浏览器、构建/类型/lint通过。来源 `docs/sources/T024-cover-tags.json`，验收 `docs/verification/2026-09-08-cover-tags.md`。上传/选择面板T027、编辑表单T031、真实身份和云服务仍待接入。下一项T025：文章反馈。


T025：文章反馈及管理员查看已完成本地实现。支持选择、可选说明、修改恢复、重复去重、过期保护及按版本分页查看；员工不能反馈无权文章。128项单元、80项数据库、124项浏览器和构建/类型/lint通过。来源 `docs/sources/T025-feedback.json`，验收 `docs/verification/2026-09-08-feedback.md`。真实Clerk/Supabase与公司准入配置仍待办。下一项T026：PDF阅读与导出。

T026：单篇正式文章PDF阅读、下载、权限复核打印、关联PDF附件预览已完成本地实现。共用基础文字/列表/表格、导出封面；7页140行样例已检查。134项单元、81项数据库、132项浏览器、2项实际PDF及构建/类型/lint通过。来源 `docs/sources/T026-pdf.json`，验收 `docs/verification/2026-09-08-pdf.md`。PDF运行需本地Chromium和中文字体，部署时另验；完整富内容、Admin草稿预览及真实服务待后续接入。下一项T027：图片、影片和文件块。

PDF专用验证：先执行 `npm run test:pdf` 生成本地样例，再执行依赖样例的 `npm run test:e2e`。这里创建的PDF仅使用测试文章，不是真实业务文件。

T027：已有文章媒体/表格编辑、封面选择、私有上传、版本关联、员工阅读与PDF图片/表格已本地验收。138项规则、85项数据库、146项浏览器、3项实际PDF及构建/类型/lint通过。来源 `docs/sources/T027-media.json`，验收 `docs/verification/2026-09-08-media.md`；当前PageBody/PDF render以T027为准。完整BlockNote及真实服务/真机待办。下一项T028：提示框、代码框和分页标签。

T028：提示框、原文代码复制与文字分页标签已接入编辑、阅读及完整打印/PDF。141项规则、86项数据库、156项浏览器、4项实际PDF及构建/类型/lint通过。来源 `docs/sources/T028-rich-blocks.json`，验收 `docs/verification/2026-09-08-rich-blocks.md`；MediaBlocks/PDF render当前以T028为准。标签内嵌套富内容、语法高亮及真实服务/真机未交付；完整BlockNote为T031。下一项T029：数学公式和流程图。

T029：数学公式、有限 Mermaid 流程图、错误原文及重试、中文基础强调和列表已接入已有文章编辑、正式阅读与 PDF。本地145项规则、87项数据库、166项浏览器、7项实际渲染/PDF及构建/类型/lint通过。来源 `docs/sources/T029-science.json`，验收 `docs/verification/2026-09-09-science.md`。完整Markdown/BlockNote、流程图缩放/全屏与真实服务/真机未交付。下一项T030：管理员 Tasks 看板与列表。

T030：管理员六状态看板与列表已完成本地实现，支持当前个人指派、标题/类型/状态筛选、真实数量、30条分页和手机列表；新草稿标明旧正式版仍可读。148项规则、89项数据库、174项浏览器与构建/类型/lint通过。来源 `docs/sources/T030-workspace.json`，验收 `docs/verification/2026-09-09-workspace.md`。真实服务/真机待办；完整编辑器和审核发布操作仍按后续任务接入。下一项T031：BlockNote编辑器。


T049：管理员分类设置已本地验收，支持分组/子分类、排序、访问范围、启停和不可变配置记录；编辑器分类随版本保存，父级限制即时覆盖员工搜索、文章、文件与PDF。273项单元、323项数据库、492项浏览器及构建/类型/lint通过。真实服务/公司配置、真机和部署仍待验收。记录 `docs/verification/2026-09-09-categories.md`，来源 `docs/sources/T049-categories.json`。下一项T050：自定义表单；统一设置历史界面为T053。


T050：自定义表单已本地验收。管理员组合已有字段、独立必填及单双栏，按角色开放；员工提交固定版本记录，Admin处理及备注留审计。重复提交不重复建记录，冲突/未知结果保留输入，多次载入保留备份。291项单元、337项数据库、522项浏览器及构建/类型/lint通过，记录 `docs/verification/2026-09-09-forms.md`，来源 `docs/sources/T050-forms.json`。真实服务、公司配置、真机和部署仍待验收；没有执行脚本或外部自动化。下一项T051：导航设置。


T051：导航设置已本地验收。管理员可配置最多40个既有页面/分类快捷入口、名称、顺序、角色和启停，隐藏入口不改变内容权限。员工菜单按服务端当前权限过滤，分类页包含全部可读正式归属；准确重试、冲突保留和配置审计已接入。306项规则、348项数据库、548项浏览器及构建/类型/lint通过。记录 `docs/verification/2026-09-10-navigation-settings.md`，来源 `docs/sources/T051-navigation-settings.json`。真实Clerk/Supabase、公司配置、真机和部署仍待验收。下一项T052：功能开关。

T052：七项固定功能开关已完成本地验收，覆盖显示及服务器入口，停用保留资料，恢复继续使用；管理员保存有版本、重试、冲突与输入备份保护。311项单元、356项数据库、560项浏览器及构建/类型/lint通过，由当前助手实现及自查，未使用subagent。记录 `docs/verification/2026-09-10-feature-flags.md`，来源 `docs/sources/T052-feature-flags.json`。真实Clerk/Supabase、公司配置、真机和部署仍待验收。下一项T053：设置变更记录。

T053：五类设置变更记录已完成本地验收，支持筛选、分页、操作人/时间、修改前后与当前配置对照；恢复重新校验并创建新版本，旧历史和提交保留，有准确重试与冲突保护。315项单元、364项数据库、570项浏览器及构建/类型/lint通过，由当前助手实现及自查，未使用subagent。记录 `docs/verification/2026-09-10-setting-history.md`，来源 `docs/sources/T053-setting-history.json`。真实Clerk/Supabase、公司配置、真机和部署仍待验收。下一项T054：新功能公告。

T054：新功能公告已完成本地验收。管理员配置简短说明、固定入口及启停；员工只看到当前角色与功能开关允许的公告，可进入功能、标为已读或关闭。更新采用新版本，收件状态按账号及版本保留；冲突/重试/输入备份已验证。319项单元、373项数据库、582项浏览器及构建/类型/lint通过。记录 `docs/verification/2026-09-10-announcements.md`，来源 `docs/sources/T054-announcements.json`。由当前助手实现及自查，未使用subagent；真实服务、公司配置、真机和部署仍待验收。下一项T055：自动化权限与越权测试。


T055：权限与越权已完成本地验收，63条业务接口124种请求、31页及三角色跨功能矩阵通过；修复流程图预览返回底层错误原文，关闭不使用的图片优化入口。323项单元、380项数据库、588项浏览器、9项实际离线PDF/流程图与构建/类型/lint通过。验收 `docs/verification/2026-09-10-permission-audit.md`，来源 `docs/sources/T055-permission-audit.json`。没有使用subagent。真实身份、Supabase、公司配置及设备/部署仍待验收；下一项T056两管理员完整流程。


T056：两管理员完整连续流程已本地演练，39个检查点、5轮审核和25条历史核对通过；数据库381/381、最终专项1/1及类型/lint通过。没有产品代码或迁移变更，未使用subagent。验收 `docs/verification/2026-09-10-two-admin-workflow.md`；真实账号操作表 `docs/verification/T056-real-account-checklist.md` 保持待验收。下一项T057：UI/UX对照与无障碍。


T057第一轮：核心页面UI/无障碍检查已完成，修复手机管理入口、正文框名称、深色链接和数量标注。最终323项规则、32项专项与构建/类型/lint通过；整站609/612，3个看板溢出失败已修复并专项通过，最终版未全量重跑。验收与截图见 `docs/verification/2026-09-10-ui-accessibility.md`。T057仍需其余页面逐页人工审查及真实账号/设备验收；下一步继续T057。


T057第二轮：41种界面的桌面/手机与深浅色本地检查完成，164份axe结果无自动违规，人工判断项保留。修复Q&A点击区域、统计列表结构、代码和公式语义；最终160项浏览器、323项单元、9项实际PDF/流程图及构建/类型/lint通过。截图及范围见 `docs/verification/2026-09-10-secondary-ui-accessibility.md`。未使用subagent，未改动授权或迁移。下一步T058性能、上传和导出；真实服务、账号、设备、读屏与缩放仍待验收。


T058：本地规模验收完成，覆盖300块大文章、1000条目录、200×8表格、1400篇权限搜索、两管理员并发保存与59页实际PDF。上传减少整文件复制，双50MiB冷启动样例峰值约622→331MiB。326项规则、3项规模综合、64项浏览器、9项实际PDF/流程图及构建/类型/lint通过。报告 `docs/verification/2026-09-10-performance-scale.md`；复测入口 `npm run test:scale`。没有使用subagent。真实云端速度、部署容量和账号验收仍待T059测试项目，未部署。
