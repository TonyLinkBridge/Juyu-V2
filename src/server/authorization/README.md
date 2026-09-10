# T010 · 统一服务端与数据库授权

本地权限实现；尚未连接真实 Clerk、Supabase 或 Storage。application.ts 是明确关闭的生产绑定点，当前两个文章 API 始终返回 AUTH_NOT_CONFIGURED / 503。不能把测试身份适配器放进该绑定点。

## 访问链路

Authenticate（服务器验证当前会话与公司）→ AuthorizationService（角色检查）→ ScopedDatabase（最小权限连接与临时事务身份）→ RLS / 受控仓储 → private,no-store 响应。

Authenticate 每次请求读取当前服务端身份；不能来自请求头、Cookie 自报 role、表单 JSON 或调用者指定用户 ID。T012/T013 接入真正 Clerk 和邮箱/Slack 校验，T015 处理真实角色改动。当前测试提供明确的本地身份夹具，不称作真实认证。

## 数据库账号

0003_authorization 建立两个 NOLOGIN 能力角色：

- juyu_runtime：业务 SELECT 和现有文章工作流所需的最少 INSERT/UPDATE；无 DDL、TRUNCATE、成员管理或辅助功能写权限。
- juyu_context_issuer：只管理私有 request_contexts 表，不能读取业务正文；只供可信服务器签发当前请求上下文。

部署时用两个独立 LOGIN 账号分别继承上述角色；另外保留独立迁移账号。本地测试确实创建两个独立账号连接，未只用 owner SET ROLE 冒充受限连接。所有账号仅在一次性集群存在；没有在用户机器创建系统用户。

ScopedDatabase 在每次借用的实际连接上检查：不为超级用户、BYPASSRLS、CREATEROLE、CREATEDB；不混用两个能力；不能拥有 juyu 业务表或在 juyu CREATE；session_user 必须等于 current_user，拒绝从高权限会话 SET ROLE 降级伪装。Supabase service-role/owner 不用于这条业务访问链路。

仅支持验证过的 PostgreSQL 直连或 session pooling。随机事务身份与后端 PID 绑定，事务前后 PID 不一致会拒绝。该检查不是任意 transaction pooling 的兼容保证。生产 TLS、连接数和 Supabase 实际登录权限在 T059 实测，不能照搬测试口令。

## 临时身份

服务端生成 256 位随机令牌，只把 SHA256 存入私有表；绑定查询连接 PID、成员、当前角色，60 秒有效。issuer 先写入，然后 runtime 开启事务并 SET LOCAL 令牌。RLS 读取服务端签发记录，不相信 juyu.role 或 request.jwt.claims 等自报设置。

令牌不进入 HTTP、日志或客户端。完成/失败后删除上下文，事务结束清空 LOCAL 设置。若已 COMMIT 后清理失败，只记录 AUTH_CONTEXT_CLEANUP_FAILED，避免误报保存失败；上下文到期后不能再授权，下次请求也清除过期行。部署需监控该日志，维护清理策略。运行令牌在另一连接上无效。

同一次只读事务使用一致快照，成员停用/角色变更的响应边界是后续请求；事务最长上下文时效为 60 秒。不能宣称 Clerk 改动能中断所有正在执行的数据库语句。下一次请求的身份必须由 Clerk 重新核实，不在应用层长期缓存角色。

## 权限效果

- Support 仅普通正式资料；Ops 可读普通及 OPS；Admin 可管理草稿和审核历史。正式阅读仍只取有效正式指针。
- 员工不能查询 documents 内的工作流字段；使用 read_publication 安全投影。revisions 行策略只允许有权当前正式版。
- 分类沿祖先继承 enabled/audience，循环或无完整根路径时拒绝；它是读取保护，不代替 T049 的目录编辑防循环。
- 附件必须 ready、与同一篇有权正式版本关联；AuthorizationService.asset 返回服务器下载所需的元数据，只供服务端使用。真正 Storage 对象/签名链接/下载还在 T011。
- 收藏/最近浏览只本人且资料仍有权；反馈本人当前可读版本或管理员；分析、审核、配置由管理员查看。尚未实现的个人写入、配置更改等继续默认拒绝，随对应功能添加受控写接口。
- 通知按本人的范围、有效期、目标资料权限及已启用功能开关过滤；已读状态只本人。
- 管理员完整写入必须调用 DocumentRepository。数据库额外阻止冒充另一位二审决策和直接改成员；不宣称任意 Admin SQL 都等同于完整领域状态机。公开接口不接受 SQL 或可信 Viewer。

## 接口及返回

GET /api/articles/[id] 与 GET /api/admin/articles/[id] 已使用统一 protectedResponse；尚未配置真实服务时都返回 503，伪造角色头无效。所有成功、未找到、拒绝和错误响应均 private,no-store，并设置 Vary: Cookie, Authorization；内部错误详情不返回客户端。

后续添加搜索、PDF、下载、后台写接口时必须复用统一身份及数据库边界，不能单独创建 owner/service-role 连接或缓存带权限的响应。没有在本轮添加演示登录或伪造业务内容。

## 验证来源

测试：tests/database/authorization.test.ts、tests/authorization.test.ts；原核心/辅助表测试继续回归。
PostgreSQL 文档核对：
- https://www.postgresql.org/docs/17/ddl-rowsecurity.html
- https://www.postgresql.org/docs/17/sql-createfunction.html
- https://www.postgresql.org/docs/17/functions-binarystring.html

安全辅助函数均固定 search_path 并撤销 PUBLIC EXECUTE；无动态用户 SQL。真实部署仍需要以实际 Supabase 测试账号重跑验收。

T015 更新：`applicationAuthorization` 已从当前 Clerk/公司证明构造身份并绑定成员，再使用受限连接。缺配置仍拒绝；角色变化、停用和 pending 保护详见 `src/server/members/README.md`。新请求角色必须与成员观察值匹配；真实账号/云端联合验收尚未完成。
