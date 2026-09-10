# T010 · 本地授权验收

日期：2026-09-08。工程：/Users/tony/Documents/ChatGPT/Juyu V2。只操作自动创建的临时 PostgreSQL；未连接真实 Clerk、Supabase、Slack 或 Storage。

## 交付

- 0003_authorization：两个独立 NOLOGIN 能力角色、私有短期上下文、RLS 和安全读取函数，覆盖现有 19 张业务表。
- ScopedDatabase：校验实际 runtime/issuer 登录权限；随机事务上下文绑定 PID，限时且不接受客户端自报 role；成功与失败均清理，连接不串身份。
- DocumentRepository：改为使用事务接口；所有者事务实现移到测试夹具，不能作为生产配置旁路。
- AuthorizationService：统一读取普通正式资料、后台管理快照和附件授权元数据。
- 两条文章 GET API：绑定统一响应保护，当前真实身份服务缺失时明确 503；不提供模拟登录。所有结果 private,no-store，错误无内部敏感详情。

## 实际测试结果

- npm run test:db：39/39 通过，0 跳过、0 失败。T010 新增 15 项，原 24 项继续通过。
- npm test：57/57 通过；新增 6 项 HTTP 返回和入口测试。
- npm run typecheck、npm run lint：退出码 0。
- npm run build：成功；包含 /api/articles/[id] 和 /api/admin/articles/[id] 新动态路由。
- production start 已恢复在 127.0.0.1:3211。
- 实际 HTTP：/sign-in 200，/api/health 200，/api/readiness 503。
- 向两条新文章 API 发送伪造 X-Role=admin、Bearer、role Cookie：都返回 503 AUTH_NOT_CONFIGURED，Cache-Control=private,no-store。

## 权限验证

本轮创建两个真正的独立 PostgreSQL LOGIN，而非仅 owner SET ROLE：runtime 仅继承 juyu_runtime；issuer 仅继承 juyu_context_issuer。临时口令随机产生、未打印、未写入项目。测试结束两个 pool 和临时集群关闭清理。

- 无上下文、自报 JWT role/GUC、随机令牌：不能读取内容，不能签发上下文或切换 issuer，不能 TRUNCATE。
- Support 读普通正式内容，拒绝 OPS/草稿/后台；Ops 可读 OPS。员工不能直接读取 documents 的工作流字段。
- Admin 在受限账号下完成创建、提交、指定二审、批准、排队和发布；作者自审拒绝。
- 数据库直接冒充另一位二审的 UPDATE 拒绝；成员行可用于事务锁，但直接改成员资料被拒绝。
- 停用成员以及下次请求变为 Support 的身份被拒绝相应访问。
- 成功和异常之后上下文均清理；另一连接拿到相同令牌也不能读取；到期上下文不继续授权。
- runtime 或 issuer 使用所有者账号、runtime 获得 schema CREATE：授权入口拒绝不安全配置。
- 收藏仅本人，文章下线后个人记录不可读。
- 分类祖先受限时 Support 被拒绝；分类环导致读取拒绝。
- 附件须 ready 且关联有权正式版；OPS、草稿、隔离及不存在文件均拒绝。
- HTTP 成功、未找到、拒绝、配置缺失及内部错误均不共享缓存，不泄露错误中的敏感内容。

## 审查及修复

独立静态审查发现 issuer 尚未执行与 runtime 同等级账号检查；已修复并增加 owner issuer / schema CREATE 回归。补充数据库冒充二审测试先确认失败（未拒绝），随后加强 reviews 行策略后通过。修复成员行锁受 UPDATE 策略限制的问题，WITH CHECK false 仍禁止真实成员更新。独立复核确认这些问题已解决。

新增代码初次执行缺少 ScopedDatabase 模块而失败；实现后逐步通过。最终全集与构建在修复后重新执行。

## 完成边界

T010 完成本地服务端/数据库授权层和默认关闭的 HTTP 接入点。真实 Clerk/公司/Slack 身份尚未绑定，网站仍不可真实登录；T012/T013/T015 需要真实账号验收。T011 仍须创建私有 Storage、实际上传下载并测试签名/媒体权限，本轮只验证其统一授权判定与元数据。

不把运行中事务称作实时撤销：下一请求重新取角色；当前事务受快照和最长 60 秒上下文约束。生产仅使用验证过的直连或 session pooling，T059 验证实际 Supabase 账号、TLS 和连接池。完整审核状态机仍必须走受控仓储，不保证任意 Admin SQL 都等价于合法工作流。

下一项 T011：私有附件存储与资料版本关联，接入上述统一授权。说明：src/server/authorization/README.md。
