# T030 管理员内容看板与列表

授权依据：既有 TASKS.md T030 和用户本轮“下一步”。在独立 Juyu V2 目录内顺序执行；不连接真实服务，不创建新的聊天任务。

目标：沿用指定 Tasks 的分栏、卡片、筛选布局，显示数据库当前工作版本、六状态数量、个人审核筛选、分页和手机列表。

接口：AuthorizationService.workspace(QueryInput) -> WorkspaceData；GET /api/admin/workspace；/admin 服务端页面使用同一服务。仅 Admin，身份来自当前服务器会话，受限只读重复读事务同时计算数量和本页30条内容。

- [x] 在 tests/database/authorization.test.ts 添加 T030 测试并确认缺少 workspace 方法时失败；实现 src/workspace/model.ts、src/server/workspace/repository.ts 及服务接线，验证当前指派、状态、权限降级、旧正式版、分页、归档过滤。
- [x] 适配 TasksBoard、TaskColumn、TaskCard 和 TasksFilters 为原生服务端组件；新增同数据列表，原生 GET 筛选与分页 URL。桌面可切看板/列表，手机用列表；不接模板模拟 store 和未经审核的状态变更。
- [x] /admin 沿用开通及 Admin 检查，读取失败显示重试，不能伪装成零条。新增只读 API 的私有缓存及错误响应。
- [x] 验证浏览器真实未配置接口，以及独立组件夹具的筛选、切换、分页、空/错误、键盘、手机宽度、深浅色；运行规则、数据库、全量浏览器、构建/类型/lint。
- [x] 独立代码复核，更新来源哈希、验收文档和 TASKS，恢复3211预览。

产品边界：按当前工作版本分类；“我提交的”是当前流程 submitted_by，重建草稿后不混入历史提交；“退回给我的”要求当前 changes_requested 且我是提交人。状态数量按关键词/类型/个人范围统计，不随状态选择或分页改变；本页加载数量另标。看板每页最多30条，可用状态筛选查看某一列全量分页。新增、二审和发布操作由T031/T034起继续。

完成：本地148规则/89数据库/174浏览器，构建、类型和lint通过；源目录哈希一致。真实服务和真机仍待验。当前目录没有Git仓库，未创建提交。
