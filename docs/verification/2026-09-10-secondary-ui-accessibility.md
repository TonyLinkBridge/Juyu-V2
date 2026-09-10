# T057 第二轮：其余页面 UI 与无障碍本地检查

2026-09-10。由当前助手直接实现、检查及记录，没有使用 subagent。

第二轮本地检查完成，修复四处已复现的问题。T057 仍保留进行中标记，真实账号、实际设备及读屏软件验收待办；下一项可独立推进 T058 性能、上传和导出规模检查。

## 确认的问题与修复

| 页面 | 修复前证据 | 本次处理 | 最终核对 |
| --- | --- | --- | --- |
| Q&A | 分类链接约 57×23 像素，axe target-size 报错 | 分类和同组操作链接最小高度 44 像素，保留文字下划线 | 桌面/手机无同类违规；320 像素下键盘聚焦、Enter 跳转及点击高度检查通过 |
| 使用分析 | 定义列表内混入段落，axe definition-list 报错 | 统计说明改为第二个 dd，并独立设置正常说明字号/字重 | 四种尺寸主题组合通过；手机深色数字与说明层次已人工查看 |
| 代码框 | 普通 pre 带名称却没有有效角色，aria-prohibited-attr 需要处理 | 增加 region 角色，保留滚动、复制与键盘焦点 | 四种组合通过；Tab 可退出，复制和错误重试专项通过 |
| 数学公式 | 普通 div 带名称却没有有效角色 | 增加 group 角色，保留 MathML、原文和错误提示 | 四种组合通过；公式可聚焦，实际公式/流程图专项通过 |

产品代码仅涉及 globals.css、AnalyticsDashboard.tsx、RichBlocks/CodeBlock.tsx 和 RichBlocks/Math.tsx。未改动服务端授权、审核流程或数据库迁移。

## 覆盖范围

41 种界面状态，每种均在桌面 1440×1000、手机 390×844 的 Chromium 下，分别检查浅色和深色，共 164 份 axe 原始结果及各自完整页面/首屏截图。

- 搜索：有结果、无结果、读取失败；PDF 阅读；提示、代码与标签页；公式/流程图；媒体编辑。
- 设置：字段（含空白与失败）、分类（含失败）、表单设置（含失败）、导航、设置历史（含失败与已展开详情）、成员和公告。
- 内容流程：历史列表、旧版本、二审管理、安排发布、归档/下线、归档列表、回收站、永久删除记录。
- 员工及管理资料：表单填写、表单处理、提交记录、表单空白/失败、Reference、Q&A、收藏、最近浏览、分类入口、使用分析及失败、反馈概览和详情。
- 额外 320 像素键盘检查：Q&A 分类跳转、代码区域焦点退出、标签页方向键、公式可访问结构。
- 额外加载检查：设置历史刷新期间显示状态并锁定控件；503 后显示错误、恢复控件，已有记录保留。

这不是所有可能数据、所有交互分支或所有浏览器的穷举。错误和空白样例只证明所列状态；实际账号与上传网络状态仍需连接服务验收。

## 人工视觉检查与截图

已查看 4 张桌面和 7 张手机索引，覆盖上述 41 种界面的首屏布局；另放大查看搜索、Q&A、使用分析、PDF、公式/流程图、表单设置、设置历史、成员和导航样例。已检查主标题、工具行换行、卡片堆叠、正文/说明字号和深色层次。完整截图归档供后续复查；没有声称每张完整截图的每个像素都经人工检查。

桌面索引：[1](../../output/verification/T057-secondary/gallery-desktop-1.html) · [2](../../output/verification/T057-secondary/gallery-desktop-2.html) · [3](../../output/verification/T057-secondary/gallery-desktop-3.html) · [4](../../output/verification/T057-secondary/gallery-desktop-4.html)

手机索引：[1](../../output/verification/T057-secondary/gallery-mobile-1.html) · [2](../../output/verification/T057-secondary/gallery-mobile-2.html) · [3](../../output/verification/T057-secondary/gallery-mobile-3.html) · [4](../../output/verification/T057-secondary/gallery-mobile-4.html) · [5](../../output/verification/T057-secondary/gallery-mobile-5.html) · [6](../../output/verification/T057-secondary/gallery-mobile-6.html) · [7](../../output/verification/T057-secondary/gallery-mobile-7.html)

修复后的局部示例：

![手机 Q&A 分类链接](../../output/verification/T057-secondary/qa-light-mobile-viewport.png)

![手机深色统计](../../output/verification/T057-secondary/analytics-dark-mobile-viewport.png)

PDF 的纸张区域在深色主题中保持白色，工具栏随主题变化。公式保留 MathML；审查样例流程图是明确的本地 SVG，不用该图片证明真实渲染引擎或云端资源就绪。

## 样例与真实页面边界

已登录组件直接使用项目的实际组件和最终构建 CSS，数据为明确标注的本地样例。没有为生产路由增加免登录入口；未声明的 API 返回 503。富内容样例底部因此会显示真实的“反馈暂时无法读取”状态；不将其称为正常联网反馈验收。

第一轮的真实登录页和当前未配置身份下的拒绝访问检查在本轮受影响回归中再次通过。Clerk、Supabase、公司邮箱域名与 Slack Workspace 尚未完成真实配置验收，未登录预览仍显示准备状态，不能把样例截图当成真实公司账号页面已经上线。

GitBook 阅读及富内容采用现有来源代码的本地改编，管理工作台采用 Tasks 来源结构；设置和业务流程属于 JUYU 自有实现。这轮不是 GitBook 商业产品的逐像素一致性认证。原始 98 文件、最新移植 47 文件和 3 份许可证快照哈希核对通过；追加代码框和公式两条来源记录，保留旧记录。见 [来源记录](../sources/T057-secondary-ui.json)。

## 验证结果与失败记录

| 检查 | 最终结果 |
| --- | --- |
| 第二轮审查 + 第一轮核心界面 + Q&A/分析/富内容/公式/PDF/工作台浏览器回归 | 160 / 160 |
| 单元规则 | 323 / 323 |
| 实际离线 PDF 与流程图 | 9 / 9 |
| 构建、类型、lint | 通过 |
| 第二轮 axe | 164 份结果，自动 violations 为 0 |
| 本地预览 3211 | health 200、sign-in 200；readiness 503，真实依赖未就绪 |

最终成功日志为 `T057-secondary-logs/final-browser-rerun.log`。本轮没有重新运行整站全部浏览器用例或数据库套件，不引用旧全量通过数作为本轮结果。

保留初次失败证据：初次 64 项中 4 项暴露 Q&A/统计问题；补查富内容后，28 项定向红测中 8 项复现四个问题在两个尺寸的表现。产品修复后，曾出现两类测试脚本问题：本地跳转文档未明确 UTF-8，以及历史详情尚在加载时试图聚焦禁用的刷新按钮。修正编码并等待详情/控件就绪、明确核对焦点和刷新请求后，最终 160 项全部通过。搜索样例还修正了页码类型，增加有结果/无结果/失败状态断言及重试地址。没有把这些脚本问题计为产品修复。

axe incomplete 仍保留：color-contrast 30 份、aria-valid-attr-value 10 份、link-in-text-block 4 份（按含该规则的结果份数，不是独立缺陷数）。抽查分别涉及装饰性符号、尚未打开的目录弹窗引用，以及隐藏/重叠目录链接，不能仅凭自动结果判定全部通过。已有键盘及菜单专项可提供部分证据；真实读屏、非文本对比度、缩放及不同浏览器人工验收仍待完成。本报告不宣称 WCAG 认证或全面符合。

机器记录与截图哈希：[T057-secondary-ui-accessibility.json](T057-secondary-ui-accessibility.json)。初次截图位于 `output/verification/T057-secondary-before/`，最终截图位于 `output/verification/T057-secondary/`。

## 后续

下一步 T058：记录大文章、长表格、大目录、中文搜索、上传、PDF 与并发编辑的实际测试规模和表现。真实云端、账号、Safari、实际手机、读屏软件及浏览器放大验收继续保留，不因本地 UI 检查通过而勾选完成。
