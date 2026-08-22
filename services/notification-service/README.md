# notification-service

`V2-B11-INF-002` 的独立通知、投递、离线同步和恢复边界。目标运行时为 Java 25 + Spring Boot 4.1.1，固定本地端口 `18093`（可由 `NOTIFICATION_SERVICE_PORT` 覆盖，但端口登记由仓库配置统一管理）。服务不继承 `core-api`，不跨服务写表，Phase 1 不启用 AI。

## 责任边界

- `NotificationApplicationService`：通知偏好、模板引用/安全正文、消息、投递 attempt、幂等键、失败重试和 DLQ 转移。
- `OfflineSyncApplicationService`：以 `clientEventId + tenant + principal + device` 去重；以 `clientSeq` 保证设备游标连续；以向量时钟和 `baseVersion` 显式返回冲突，不静默覆盖。
- `WorkflowPort`：Saga、定时重试、补偿、DLQ、人工恢复 seam。当前为 `InMemoryWorkflowPort`，后续可替换为 `workflow-service/job-runner` 适配器。
- `OutboxEventPort`：当前为内存 outbox；事件只携带 ID、版本、状态和安全引用，不携带原始音频、答案、token、媒体包或任意 payload。
- `InMemoryOfflineSyncStore`：带 `STORAGE_FULL`、`PERMISSION_DENIED`、`NETWORK_UNAVAILABLE` 故障注入，验证恢复路径；生产实现应使用本服务独立 schema + Outbox + Kafka/Workflow。

HTTP 入口位于 `/internal/v1/notifications/**` 和 `/internal/v1/sync/**`。业务请求要求已验证 JWT；tenant、principal、device 和权限从 JWT 解析，客户端提交的 owner 字段不被信任。资源服务器开关默认关闭时，业务请求仍不会匿名放行；生产环境必须由 IAM/OIDC 部署门禁启用 issuer/JWKS。

## 纯 Java smoke

当前开发机只有 JDK 24，因此 smoke 使用 `--release 24` 验证不依赖 Spring 的领域/应用层；服务 POM 仍固定 Java 25 和 Spring Boot 4.1.1。

```powershell
$out = 'services/notification-service/.compile-check'
New-Item -ItemType Directory -Force $out | Out-Null
$files = @(rg --files services/notification-service/src/main/java services/notification-service/src/test/java |
  Where-Object { $_ -notmatch 'adapter[\\/]http' -and $_ -notmatch '[\\/]config[\\/]' -and $_ -notmatch 'NotificationServiceApplication\\.java' })
javac --release 24 -encoding UTF-8 -d $out $files
java -cp $out com.englishflow.notification.NotificationServiceSmoke
```

预期输出：`notification-service B11-INF-002 smoke: PASS`。这项验证不等同于 Java 25/Maven、MySQL、Kafka、推送供应商、Gateway、OIDC 或真实设备运行态验收。
