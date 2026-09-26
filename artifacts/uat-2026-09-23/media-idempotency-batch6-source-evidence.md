# Media 写操作幂等专项：batch6 源码证据

## 范围与状态

- `registerMediaAsset`、`retryMediaAsset`、`upsertMediaSubtitle`、`activateMediaAsset`：源码与定向测试通过；本地 Docker/Gateway 运行回归须在 V7 管理迁移和统一重建后执行，当前不记运行 PASS。
- `mintMediaUploadUrl`：**FAIL / 未闭合**。正式 `VerifiedObjectSignedUrlPort` 对 RECORDING 明确返回 503，上传授权仍缺真正的 PUT 签名与可持久恢复的 grant 生命周期；契约没有加 `x-idempotency`。

## 实施事实

- V7 新建 media owner 的 `(tenant_id, subject_id, operation_name, idempotency_key)` 唯一收据，保存 SHA-256 规范请求摘要与首次响应 JSON。键按大小写精确匹配。
- 本地真实运行路径由 `JdbcMediaWriteIdempotency` 抢占唯一键并加资产行锁；资产/字幕状态、旧注册收据、outbox 事件及首次响应共享一个 JDBC 事务。失败回滚全部写入。同键同请求回放原响应，不再增加版本或事件；同键异请求返回 409。
- 重放时重新执行当前权限检查。注册服务的旧 JDBC 收据改为只插入，避免重复键覆盖原摘要。
- 新资产注册使用严格 INSERT；不同键并发注册同一 `assetId` 由 MySQL 主键仲裁为 409，不能再经原仓储 UPSERT 覆盖首个资产。V7 同时将旧注册收据主键范围改为大小写精确匹配。
- 对应 fragment 四项要求 `Idempotency-Key`，四项运行状态标为 `SOURCE_VERIFIED_PENDING_V7_RUNTIME`；上传授权标为 `FAIL_CLOSED_UPLOAD_NOT_CONFIGURED`。

## 测试结果

- `mvn -q '-Dtest=JdbcMediaWriteIdempotencyTest,MediaControllerIdempotencyTest' test`：5 项通过，覆盖跨实例同键并发、资产/事件/收据回滚、重复请求权限复核、变更摘要冲突，以及四路由首次响应回放。
- 将本机进程的 `TEMP`/`TMP` 设为 `C:\Temp` 后运行 `mvn -q test`：81 项，0 失败、0 错误、3 跳过。首次使用默认临时目录时，原有 `MediaJwtDecoderNegativeTest` 因 JDK loopback Pipe `Invalid argument: connect` 报环境错误；设定临时目录后通过。
- `git diff --check` 与 media fragment JSON 解析通过。

## 运行复验边界

1. 用迁移管理凭据执行 media Flyway V7，确认 owner 业务凭据仅保留 DML；不要用运行账号执行 DDL。
2. 一次批量重建 content/media 后，经 Gateway 对四路由测首次请求、同键同体重放、同键异体 409、缺键 400、跨主体/租户拒绝，并核对 media 资产/收据/outbox 各只提交一次。
3. 上传 URL 路由维持 FAIL，直到真实 PUT intent、对象存储授权和持久 grant 生命周期闭合；现阶段不得作为可用上传能力验收。

既有 `MediaAsset` OpenAPI 模型与运行时 `safeView()` 字段/枚举不同。本次只对齐四项状态码和幂等声明，没有把不兼容的模型冒充响应 Schema。
