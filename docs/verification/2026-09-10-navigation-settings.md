# T051 导航设置 · 本地验收

日期：2026-09-10。项目：`/Users/tony/Documents/ChatGPT/Juyu V2`。

## 已实现范围

管理员从 `/admin/settings/navigation` 配置员工快捷入口：名称、既有页面或稳定编号分类目标、前后顺序、Support/Ops/Admin 可见角色、启停和移除。最多40项，移除仅移除入口，不删除内容。可选页面为帮助中心、OPS Internal、Reference、Q&A、收藏、最近浏览和内部表单，不接受任意网址或执行程序。

员工各阅读页面使用服务端筛选后的菜单；手机可展开，电脑横向显示。品牌首页、退出及仅Admin可见的后台入口继续保留。菜单与原GitBook文章树分别配置，隐藏入口不能收回或授予资料权限。分类入口只显示当前可读的已发布资料，含子分类和分页；同篇文章的多个分类归属都可进入，左侧文章树仍只显示一次。

## 权限与保存

- Admin配置接口 GET/PUT `/api/admin/navigation` 返回完整配置；员工 GET `/api/reader-menu` 仅得到已筛选的编号、名称和目标，不包含隐藏项。所有接口均 private, no-store；PUT校验真实身份、管理员权限、同源、内容格式及64KiB上限。
- roles只决定入口显示，OPS及分类父级/启停/当前正式修订仍独立核对。Support即使被加入OPS入口角色也读不到OPS。分类无当前可读正式文章时入口被裁剪；旧版草稿改动不取代已发布归属。
- 配置使用整体版本和不可变变更记录；同一管理员、同一期望版本和相同配置的重试只形成一次变更。不同并发修改会冲突，等待期间管理员降权后写入拒绝。
- 从未保存时明确返回版本0的默认入口；保存空列表或全部停用后保持空列表，不能回退默认。目标仅为已有页面或真实分类；当前不可读分类不能因为入口名字而泄露。
- 未知保存结果保留原请求并冻结修改，准确重试；冲突、加载失败和多次重新载入保留输入及累积备份，可复制或放回编辑区重新核对。未保存/待确认/备份未处理时离开提醒。
- 追加迁移 `0023_navigation_settings.sql`，既有22个迁移字节未修改。新增设置沿用受限数据库角色与settings/setting_versions；RLS和存储函数自身独立校验。

## 验证证据

- 单元：306/306通过；分类入口新增4项、导航模型/HTTP3项、设置客户端8项。
- 真实临时PostgreSQL：348/348通过；新增11项包括原始SQL拒绝、角色变更、缺失验证、并发单胜、同配置重试、不可变历史、多分类归属、隐藏菜单与直接阅读独立，以及22→23升级。
- 专项浏览器：管理导航18/18、员工快捷菜单/分类页8/8，均含电脑与手机。
- 全站浏览器回归：548/548通过（5.9分钟）；之后仅补充截图等待主题背景过渡完成的断言，员工专项再验8/8通过，产品代码未再变更。
- 最终生产构建、类型检查、lint全部通过，无遗留错误或警告。
- 独立源码与最后小改动复核无未解决项，详见同目录 `2026-09-10-navigation-settings-review.md`。
- 桌面/手机截图使用明确标识的本地测试内容；后台明暗主题、员工菜单及分类页已视觉检查。这些样例不是已登录的真实公司数据，未在生产应用增加登录旁路或演示数据。

## 一次构建差异的处理

第一轮员工专项7/8通过，手机版折叠菜单失败。源文件已有规则，但生成CSS没有 reader-shortcuts/category-landing。保留当次CSS并移走生成缓存后重建，新CSS包含相应规则，8/8专项通过；最后一次构建再次核对三组导航样式存在。没有用放宽测试或额外页面样式覆盖来绕过该失败。底层缓存失效原因尚无法确认，保留日志以便复现；本次最终产物已通过548项完整回归。

## 截图

- `output/verification/navigation-settings-desktop.png`
- `output/verification/navigation-settings-mobile.png`
- `output/verification/navigation-settings-dark-desktop.png`
- `output/verification/navigation-settings-dark-mobile.png`
- `output/verification/reader-shortcuts-desktop.png`
- `output/verification/reader-shortcuts-mobile.png`
- `output/verification/category-landing-dark-desktop.png`
- `output/verification/category-landing-dark-mobile.png`

## 未验收边界

Clerk/Supabase测试项目、公司邮箱与Slack Workspace允许列表尚未配置，真实账号、真实云端存储/迁移、生产部署和物理设备仍未验收。浏览器真实网站仅验未配置时的登录分流和API拒绝；成功业务交互是隔离组件样例，权限测试则使用真实临时PostgreSQL。没有连接或修改外部服务。

本阶段不实现功能开关、统一设置历史/恢复界面和功能公告；分别为T052、T053、T054。数据层历史已有记录，不等同统一历史界面已经交付。导航配置不是自动生成程序。

临时日志与阶段基线：`/private/tmp/juyu-t051/`。本阶段本地验收完成；T051仍标为[~]，真实联合验收后才能勾选完成。

## 最终回读与来源

3211本地预览已更新。真实浏览器打开后台导航设置进入 `/admin/sign-in`，员工分类页进入 `/sign-in`。健康检查200；真实就绪检查、导航GET/PUT和员工菜单API均503/private,no-store，伪造x-role也不能读取或写入。后台流式页面在HTTP层可能返回200携带框架跳转，不等于管理页面已开放；已用真实浏览器确认最终地址。

新增30个修改/创建的产品文件及两份验收文档纳入 `docs/sources/T051-navigation-settings.json`；此前来源记录继续保留，仅追加本阶段Tasks工作台入口改编。下一项T052功能开关。
