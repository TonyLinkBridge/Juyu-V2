# T053 设置变更记录实施计划

用户已批准 T053 下一步，由当前助手在既有工程直接执行，不使用 subagent。沿用 React/Next.js/TypeScript/PostgreSQL；不连接外部服务、不修改历史迁移。

## 范围与设计
统一呈现字段、分类、表单、导航及功能开关五类配置的不可变版本。列表按时间稳定排序，类型过滤和20条分页；详情展示操作人（已有记录关联当前名称，未知不补造）、时间、前后值、当前版本，以及恢复来源。默认导航/开关尚未保存时没有历史条目。
恢复只接受来源标识/版本、当前预期版本和请求编号；服务器从历史读取目标，调用原有验证写入，产生新版本并原子保存恢复来源。失败整体回滚；重复请求返回原恢复回执，不重复写入；回执表示当次操作完成，不宣称其版本仍是当前版本。恢复结果未知时固定原请求，冲突必须刷新详情重新确认。表单关闭仍可查看设置历史，但恢复表单须先开启；功能开关恢复入口始终可访问。
旧分类形成循环、字段不可变类型、表单字段版本依赖和目标有效性继续校验；不迁移文章快照、不修改提交记录或旧历史。管理员实时资格及同源/有界JSON/无缓存维持原规则。

## 顺序与验收
- [x] 契约与数据库：tests/setting-history.test.ts、tests/database/setting-history.test.ts 先验证缺失功能；实现 src/setting-history/model.ts、src/server/database/migrations/0025_setting_history.sql、src/server/setting-history/repository.ts。覆盖五类读/恢复、来源审计、权限、并发、旧配置失效及重复请求。
- [x] API与客户端：/api/admin/settings/history 列表，/detail 详情，/restore 恢复；严格响应及原请求回执。实现 src/setting-history/client.ts 与服务授权层。
- [x] 后台页面：/admin/settings/history，历史过滤/分页、前后/当前对照、确认恢复、未知结果重试/刷新核对；工作台和各设置页添加历史入口。tests/e2e/setting-history.spec.ts 验证电脑手机、深浅色和请求失败。
- [x] 当前助手自查、针对性测试后全站回归、build/type/lint、来源哈希和验收记录。真实身份/云数据库/公司配置、真机与部署保持待验收。
