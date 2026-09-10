# T010 · 数据库和统一服务端授权

已批准范围：沿 TASKS T010 实现本地可验证的权限入口；真实 Clerk/Slack 由 T012/T013，实际 Storage 对象由 T011 验收。当前网站默认认证适配器拒绝访问，不能伪造已登录。

## 设计

1. 追加 0003_authorization.sql：juyu_runtime 和 juyu_context_issuer 两个 NOLOGIN、NOBYPASSRLS 角色。仅 issuer 能签发短期内部上下文；runtime 无 DDL、TRUNCATE、角色管理、成员管理权限。迁移账号与运行账号分开。
2. 上下文存放私有表，含随机 256 位令牌的 SHA256、连接 PID、成员、角色、到期时刻。服务端认证适配器每次请求取得当前 Viewer，签发上下文后在事务 SET LOCAL 中绑定随机令牌；RLS 不信任用户自报 role 或 JWT 字符串。令牌不返回浏览器，事务结束删上下文，连接复用不残留。真实生产服务需配置两个独立最小权限登录账号；本轮只在临时数据库创建登录夹具。
3. 统一 ScopedDatabase 校验实际运行账号不为 owner/superuser/BYPASSRLS、不能继承 issuer。现有文档仓储改为消费事务接口；所有者事务仅留测试工具中，不作为生产旁路。
4. SECURITY DEFINER 读取辅助函数固定 search_path、撤销 PUBLIC EXECUTE；只暴露布尔权限判断和有权正式版本投影。分类限制沿祖先继承，遇到循环拒绝读取。员工不能直接读 documents 内的草稿工作流字段。
5. RLS 覆盖 19 张业务表：管理表仅 Admin；正式内容依角色/生命周期/版本/分类；附件须 ready 且关联有权正式版；个人资料只本人且资料仍可读；分析仅 Admin。尚未实现的辅助功能写接口继续默认拒绝，避免提前开放不完整操作。
6. 服务端统一 authenticate -> authorize -> transaction -> no-store Response。提供文章读取、管理读取、附件读取授权入口；默认生产身份适配器拒绝（503），后续直接接 Clerk。附件入口只授权元数据，不提供未经验证的 Storage 下载。

## 验证

- [x] 先写真实受限登录连接测试，不能用 owner SET ROLE 代替所有测试；伪造 role/GUC/上下文、越权表读取和写入拒绝。
- [x] 三角色普通/OPS/草稿矩阵；停用成员、改角色后的下一请求、已下线资料；分类祖先限制与循环拒绝。
- [x] 附件、个人记录的猜 ID、旧版与跨资料访问；后台指定二审流程在真实 runtime 下仍通过。
- [x] 事务回滚后上下文清理、连接复用不串身份；错误及成功响应均 private,no-store；默认未连接身份忽略请求的角色头。
- [x] 原 24 项数据库、51 项单元、lint/typecheck；涉及新路由时额外 build 和本地路由请求检查。独立代码审查与验收记录。

本轮不把真实第三方认证/Storage 或部署标为完成；T010 记录本地授权完成边界和后续真实验收依赖。

本地验收完成：`docs/verification/2026-09-08-authorization.md`。第三方集成依赖保持独立待办。
