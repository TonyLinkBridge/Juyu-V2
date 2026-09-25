# 员工目录数据

T017 平面目录及 T018 分类树使用同一服务器身份与数据库授权边界。`navigationTree()` 在同一只读事务中读取正式版本标题、正式版本分类关联及允许分类，`tree.ts` 仅负责组装，不替代授权。

输出节点：document 包含 type/id/title/href；group 包含 type/id/title/descendants。不会发送分类 audience、内部 position、正文、审核状态或不可读标题。主页和 `/api/navigation` 使用树；旧 `navigation()` 保留平面已发布元数据查询。

排序与归属：

- 分类 position 升序；相同 position 按稳定分类 ID。
- 每个层级先列子分类，再列文章；文章按标题、ID 稳定排序。
- 多分类文章仅显示一次，取完整目录顺序最前的所属分类；阅读权限仍检查所有正式分类。
- 未分类文章显示在根列表末尾。
- 无可读后代的空分类及其空祖先不输出。
- 缺失/循环祖先的关联不降级成根文章；分类重命名不改变稳定 ID 和归属。

GitBook PagesList 分组分支递归渲染，PageGroupItem 默认展开。折叠时用 hidden 隔离子链接，按钮提供 aria-expanded/aria-controls。页面重新导航会重新展开并定位当前项；暂不记忆个人折叠偏好。样式沿用 GitBook 结构并适配 JUYU；多层分类没有使用上游 sticky 分组标题，避免叠加遮挡。

T049 实现后台分类编辑、移动及排序控件。T019 实现正文；T021 手机抽屉本地状态见下文；其余任务按当前 TASKS.md 执行。真实 Clerk/Supabase 联合验收仍需用户准备测试配置。

## T019 正文与本页目录

员工主页通过 `AuthorizationService.reader(requested)` 在同一受限只读事务中获取目录和当前正式正文。选中的 ID 必须存在于已授权目录；未知、无权、下线和草稿内容都不返回正文。员工输入不能指定后台版本。返回的 Publication 仅有 id/title/revision/body。

当前数据库 body 是文本快照。`parseReaderBody` 是有限文本适配层：段落、# 至 ### 标题、顶层有序/无序列表；它不是完整 Markdown 或 BlockNote 引擎。其余输入保留字面文本，HTML、媒体语法和URL不会变成可执行节点或外部资源；代码围栏内的标题不会进入本页目录。T027–T031 再处理富内容与编辑器转换。

正文与目录共用解析所得的顺序 ID（section-1 等）；重复中文标题仍有独立链接，固定正式版本内刷新保持稳定。发布新版本后段落顺序可能变化，因此这些链接不是永久跨版本引用。

GitBook PageBody/PageAside/DocumentView/Heading/Paragraph/ScrollSectionsList/useScrollActiveId 适配记录见 `docs/sources/T019-reading.json`。正文使用 React 文本输出，无 HTML 注入或供应商外部服务。右侧目录在窄屏放在正文前，可原生展开/收起。滚动高亮处理长段落、页尾和反向滚动；点击/深链接目标在页尾受滚动极限限制时仍保持选中，同 hash 再次点击也重新定位。


## T020 标题搜索（历史实现，当前由T041扩展）

`AuthorizationService.search(q,page)` 在同一受限只读事务获取正式目录后调用 `searchTitles`；后者是匹配/展示投影，不是授权函数，不可传入未经筛选的数据。标题、数量、分类路径、翻页来源于同一快照。每页20条，以目录顺序排列并按ID去重；空格分词采用AND字面包含，ASCII英文忽略大小写，中文无需分词库。

员工页 q 存在时显示结果，不读取正文。原生GET保留刷新/前后导航；JS提供输入错误、组合输入保护、清空、快捷键及提交等待提示。无JS时依然可提交并由服务端拒绝非法参数。查询存于正常URL/浏览器历史，不另写localStorage或分析服务；点击结果走原有reader授权。结果页使用列表/链接而非弹出框listbox。

T020当时只搜索正式标题，没有正文或独立索引。当前T041行为见下；真实身份/数据库联合验收待配置。


## T021 响应式文章目录

TableOfContents将同一份已授权内容交给HeaderMobileMenu。桌面显示侧栏，窄屏支持原生dialog时显示按钮和弹层；未支持/SSR前为details回退。副本只改变呈现，不是权限过滤；隐藏副本仍包含已授权标题，不可据隐藏代替鉴权。

原生modal让背景inert，首尾Tab循环另过滤不可见元素，避免键盘跳入浏览器chrome。body固定及原滚动位置在关闭/卸载时恢复。当前项在打开菜单和切回桌面时重新定位，T023起由ReaderChrome测量实际顶部高度；ScrollContainer观察尺寸，在公告加载/关闭或断点变化后重新定位当前项。

新reader-scroll-region提供宽表格/代码局部横向滚动，富内容渲染器尚未接入，不能把CSS夹具验收当成正式表格功能完成。手机真实设备和已登录联合验收仍待配置。


## T022 文章路径与前后篇

`pageNavigation`只接收既有reader快照中的已授权目录：迭代深度优先展开，保留祖先链，以文章ID去重，然后取前后项。它不负责授权，禁止从管理目录直接调用。ReaderNavigation在正式正文与选中ID一致后才调用；页面底部链接重新经过reader授权。当前分类没有独立页面，所以面包屑使用文字层级，帮助中心链接返回目录。

回到顶部是文章底部按钮；点击后焦点到reader-page-title，再按prefers-reduced-motion选择立即/平滑滚动，不修改URL或hash。保留原章节深链接的刷新语义。未找到文章不渲染这些控件。


## T023 外观与通用公告

主题偏好只影响外观，不携带身份或权限。根布局使用 Fumadocs 官方 RootProvider（next-themes）处理首次绘制、系统变化和跨标签同步，所有入口共用官方 ThemeSwitch 与 `.dark` 状态。EntryShell 的 Footer 可用于所有入口。公告仅由已通过成员准入且读取成功的 HelpCentre 分支传入，默认可信通用政策。ID/版本关闭标记不代替角色授权；T054 若接入自定义公告，必须先服务端筛选，不能把全部内容下发后按角色隐藏。

ReaderChrome在公告换行/出现/关闭时更新顶部实际高度；目录尺寸观察修复SSR隐藏公告、hydration后出现导致的末项裁切。主题/公告本地存储失败时仅保证当前页面可操作。真实Clerk登录控件的主题仍需真实项目验收。


## T024 封面和标签

Publication的可选tags/cover仅来自当前授权正式版本；无值继续兼容既有无封面文章。PageCover接受规范UUID，不使用外部URL；PageCoverImage使用原生img携带会话请求/api/assets，不经过图片优化缓存，支持失败前/后hydration恢复。PageTags按正式快照渲染普通文本标签；当前无标签筛选页面，不添加假链接。新保存元数据不会影响员工正在阅读的旧正式版。

本地浏览器合成条纹图只用于比例/裁切/明暗排版检查，来源位于tests/fixtures/article-cover.png。上传选择和BlockNote编辑UI仍待T027/T031。


## T025 文章反馈

PageBody按文章ID与正式版本挂载PageFeedbackForm。独立GET/PUT受保护接口，仅恢复本人反馈；读取失败仍可阅读正文。评分选择后聚焦可选说明，显式提交且收到成功响应才提示保存。重复重试不计多次，不同过期内容须重新读取；输入不写浏览器持久存储。后台/admin/feedback要求当前Admin，按版本汇总、分页明细。接口与迁移见src/server/feedback和0007_feedback，验收见docs/verification/2026-09-08-feedback.md。

## T026 PDF

阅读正文新增PDF链接，单篇正式版打印视图用同一parseReaderBody，基础管道表格同时在普通阅读与PDF呈现。PDF正文HTML只由内部转义输出函数构造，不能传入用户HTML或外部图片URL。封面preview经/api/assets读取，服务器生成用校验私有字节内嵌；附件PDF单独预览，不合并。

应用打印按钮先重新核对版本与封面权限；下载服务器在生成前后重新授权。服务端Chromium运行、资源限制和未接功能见docs/verification/2026-09-08-pdf.md。完整富内容与Admin草稿预览留后续任务。

## T029 公式、流程图和有限文字格式

块公式用本地 KaTeX 生成受限 MathML；流程图由离线服务器生成 SVG，以图片读取，生成前后复核正式版本和权限。管理员预览为独立 Admin POST，员工不能传入原文任意生成。

基础文本适配支持中文加粗、斜体、行内代码，React 转义与 PDF 转义分别输出。不是完整 Markdown：不支持嵌套强调和完整嵌套列表；缩进列表当前平铺；表格单元格仍为纯文本。原代码围栏保留字面输入。新内容块目前位于基础正文之后，完整文档内穿插留 T031。

来源及限制见 docs/sources/T029-science.json，验收见 docs/verification/2026-09-09-science.md。


## T041 统一正文检索

当前 `AuthorizationService.search(q,page)` 使用同一授权事务内的目录和 `searchPublications`。0014迁移同步维护不可变修订的私有检索投影；原生GIN字组仅缩小候选，仍须字面AND匹配，并按当前正式指针和 `can_read_revision` 过滤后计算数量。搜索标题、标签、可见正文与文字内容块，返回20条分页、正式类型/版本/标签和安全摘要。按正式标题/ID稳定排序；不做相关度排序、语义/OCR或文件内部解析。旧版本继续可搜至新稿重新审核发布，归档/下线/删除立即影响后续查询。

`searchTitles` 仅保留给历史标题测试和员工页初始化空/错误状态；它不再是正式检索实现。摘要在服务器授权后生成，通过React文字节点显示；结果链接重新进入现有reader授权。浏览器样例与真实账号验收分开，详见 `docs/verification/2026-09-09-unified-search.md`。
