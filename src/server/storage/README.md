# T011 · 私有附件与文件备份

> 2026-09-10 当前接入说明：[T059 测试环境配置](../../../docs/setup/T059-test-environment.md)。下文保留各阶段历史记录；公司准入、业务授权与阅读端均已完成本地实现，当前迁移为 0001–0026，真实项目验收仍待完成。

本地实现已完成；尚未连接真实 Supabase。测试使用临时磁盘文件、本地 HTTP Storage 协议夹具及真实临时 PostgreSQL，不代表云端已配置。

## 读取链路

浏览器请求同站 `/api/assets/[id]`。服务器先取得可信身份，再通过 T010 授权服务查询附件；只允许读取当前有权正式版本关联的 ready 文件。对象读取发生在授权通过之后。每个请求（含视频/PDF 的 Range 请求）重新授权，不向浏览器返回 Storage 对象地址或签名链接。

- 桶固定为 `juyu-private`，对象键必须是附件自身 UUID；每次读取/写入先验证桶为 private。
- 仅支持单段 Range，支持首尾区间、开放结尾与后缀范围；无效范围返回 416。
- 响应使用 `private, no-store`、`nosniff`、同源资源策略和 sandbox；不转发上游缓存及敏感头。
- PDF、指定图片/音视频类型允许内嵌；HTML、SVG、未知类型强制下载。内嵌类型依赖已验证的附件元数据；真实上传的内容检测、大小限制和隔离流程仍属 T027/T031。
- 文件名清理控制字符后编码；校验上游状态、Content-Length、Content-Range，错误不暴露内部地址和凭据。
- 默认等待响应头期限 30 秒；上传流结束后才开始等待响应的计时，收到响应头即清除此计时，不因整个下载超过 30 秒截断健康传输。调用者取消信号可中止对象读取；底层运行时的网络限制及部署平台最大请求时长仍需真实环境验证。
- 权限更改影响下一次请求；已经下载或已开始传输的字节不能收回。不提供 Admin 草稿预览旁路。

实际 HTTP 入口仍默认拒绝：真实 Clerk/公司身份适配器未接入时返回 503 AUTH_NOT_CONFIGURED。仅填写 Storage 配置不会开启访问。

## 将来配置 Supabase 测试项目

以下为待执行步骤，本轮未操作真实项目：

1. 由操作人员在安全配置处填入项目 URL 和服务端专用凭据，不放入浏览器或聊天记录。
2. 通过 `SupabasePrivateStorage.provisionPrivateBucket()` 显式建立固定私有桶。网站请求不会自动创建桶；若同名桶已公开则拒绝，不静默修改。
3. 操作人员在指定项目执行 `supabase-setup/private-bucket-policy.sql`。该 SQL 不进入通用应用迁移；它要求桶已存在且 private，为 anon/authenticated 添加针对该桶的 restrictive 策略，阻止已有宽松策略放行。服务端专用凭据仍须先通过应用授权。
4. 真实验证：匿名及普通认证直链不可读、服务器授权读取成功、猜路径/草稿/角色降级/归档/换正式版本后拒绝；视频和 PDF 范围读取正常。
5. 在测试项目完成实际文件备份及恢复比对后，补齐 T011 云端验收记录。

适配器按官方 Storage REST 协议独立实现，未引入或复制 SDK 实现。参考：[私有桶说明](https://supabase.com/docs/guides/storage/buckets/fundamentals)、[官方 Storage SDK 协议来源](https://github.com/supabase/storage-js/tree/master/src/packages)。

## 文件备份与恢复

`backupFiles(store, assets, destination)` 与 `restoreFiles(store, source)` 仅供服务端操作人员调用，没有对外 API。

- 备份包含文件实际字节、附件元数据和 SHA256 清单。新目录权限 0700，文件 0600；不覆盖已有目录。失败只清理本次新建目录。
- 调用者须提供与一致数据库快照对应的完整文件清单，包括仍需保留的历史版本、隔离文件；该函数不会自行查询数据库或证明清单完整。
- 恢复先检查整个清单及所有本地文件的 ID、大小、哈希、重复项和非符号链接要求，检查通过才上传。
- 目标应为空桶；上传不覆盖对象。每次上传后重新下载并比对大小和 SHA256。
- 若网络故障造成部分对象恢复成功，不自动删除目标文件；需要操作人员核对已恢复对象并制定重试或清理方案。本地备份目录须保持可信、恢复期间不可被其他进程修改。

Supabase 的数据库备份不包含 Storage 对象字节，因此数据库和媒体都要备份。[官方备份说明](https://supabase.com/docs/guides/platform/backups)

本模块不是完整站点恢复工具：一致快照、完整清单采集、保留周期、定时执行、密钥保护及整站恢复演练归 T060。真实云端恢复、真实浏览器图片/影片/PDF 阅读与导出仍待相应任务。

## 本地检查

运行 `npm test`、`npm run test:db`、`npm run typecheck`、`npm run lint`、`npm run build`。本轮结果见 `docs/verification/2026-09-08-private-files.md`。
