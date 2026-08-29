# 数据流与边界

> v2 数据流采用 Gateway → 服务侧 PEP → 领域服务 → Kafka + transactional Outbox + AsyncAPI。每个服务拥有自己的事实和写权限；`core-api` 仅是迁移期兼容实现。RabbitMQ 只保留其 v1 兼容语义，Redis 不是事件事实源。

Outbox、consumer dedupe、重试/DLQ/replay、Saga/补偿、双人审批和人工恢复的 D2 状态机与运行边界见 [Phase 1 事件可靠性与恢复契约](event-reliability-and-recovery.md)。

## 用户身份

平台登录凭证只在 `iam-service` 与 Gateway/IAM 边界处理；IAM 校验账号密码、签发自有 JWT Bearer Access Token 并发布 JWKS。API 只接收认证中心签发、audience 为 `yuxuexing-api` 的 Access Token。业务服务使用已验证的 subject/tenant 上下文，不在日志中打印手机号、邮箱、Refresh Token 或设备敏感标识。每个领域服务仍需独立验签并执行 PEP。

## 学习记录

每次开始、提交、完成、跳过和复习都由 `learning-service`/`assessment-service` 写入自己的事实并在同一事务写 Outbox，再由事件消费者生成进度、报告、排行榜和通知视图。提交必须具备客户端事件 ID、服务端幂等键和可回放事件。

## 内容发布

草稿 -> 审核中 -> 发布 -> 下线。客户端只能读取已发布版本。内容记录来源、版权状态、授权凭证、审核人员、版本与发布时间。

## 离线下载与同步

- 可下载内容：用户已授权访问的词书、阅读包、音频包和练习包。
- App 可使用 SQLite 保存离线索引和学习事件队列；H5 使用 IndexedDB 保存有限进度数据。
- 弱网恢复后经 Gateway 批量补传；服务端按事件 ID/幂等键去重并聚合，不覆盖已完成学习记录。
- 不提供批量导出完整商业题库、原始媒体或可直接传播的资源包。

## 媒体分发

- 音频、视频、图片、离线包和 3D 资产走 OSS + CDN。
- 视频使用 HLS 或等效自适应分发；音频支持按句缓存和逐句复读。
- 资源使用版本哈希、访问授权和过期 URL 控制。

## Phase 2 AI 数据流

原始输入、脱敏输入、模型请求、结构化输出、用户采纳和重做数据必须由对应服务单独保留并经 `content-safety`/审计链管理。Phase 1 不产生模型请求或 AI 会话数据。

## 数据删除

用户删除请求由 IAM 发起编排，覆盖账户、学习记录、音频、分析标识和第三方同步副本；各服务返回删除/匿名化结果并可回放。法律要求保留的审计记录必须匿名化、限制访问并保留依据。

## 服务间协作规则

- 跨服务只允许使用版本化 OpenAPI、gRPC 或 AsyncAPI 事件；不能通过数据库读取另一个服务的表。
- 关键链路必须传播 `requestId`、`traceId`、`eventId`、`clientEventId` 和 `Idempotency-Key` 的各自语义。
- 事件消费者必须支持重复、乱序、延迟、失败、DLQ 和回放；订单、权益、学习完成和权限变更必须具备补偿/对账路径。
