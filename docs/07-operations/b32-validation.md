# B32 学习、评测、通知、Kafka 与 Redis 运行验证

> 日期：2026-08-25  
> 模式：`local-real`，真实 Keycloak JWT、Gateway、服务 owner MySQL、Kafka 19092、Redis 16379  
> 结论：B32 的本机运行切片已通过；Kafka/Redis 证据是本地运行验证，尚不等同于生产多 broker/真实异步 worker 的发布承诺。

## 运行命令

领域链路要求 B 组服务以真实 OIDC 启动：

```powershell
$env:B30_REAL_OIDC = 'true'
pnpm b32:domain-runtime
pnpm b32:kafka-runtime
pnpm b32:redis-runtime
pnpm redis:validate
```

脚本只输出状态、计数、哈希或 opaque ID；不会输出密码、JWT、refresh token、authorization code 或浏览器存储内容。

## 领域链路证据

`b32-domain-runtime.mjs` 使用本地 Keycloak 动态创建一次性测试 principal，并经 Gateway 调用：

- assessment placement 创建、重复 start 幂等、题目提交、规则化服务端判分和 report 读取；
- learning plan、SRS review、重复 review、overview 和 daily summary；
- notification preference 读取/写入/重复写入、消息写入和消息读取。

最近一次通过：

| 证据 | 结果 |
|---|---|
| runId | `b32-2026082513` |
| Gateway/API checks | 15/15 PASS，均带 requestId/traceId |
| assessment sessions/reports | `1/1` |
| learning review/SRS state | `1/1` |
| notification preference/message/outbox | `1/1/1` |
| subject/credential safety | `subjectBound=true`，`credentialsPersisted=false`，`tokenValuesEmitted=false` |

本轮修复了两个真实缺口：本地 Keycloak User Profile 注册了服务端派生的 `tenant_id/device_id/permissions` 属性；notification JDBC message 查询补齐了 `channel` 列。服务端仍只接受已验证 JWT，客户端不能通过 body 或头部提交这些事实。

## Kafka/Outbox 证据

`b32-kafka-runtime.mjs` 在固定本地 Kafka 创建并验证六个契约 Topic：

`platform.assessment.v1`、`platform.content.v1`、`platform.events.dlq.v1`、`platform.learning.v1`、`platform.notification.v1`、`platform.workflow.v1`。

它从真实 `content_service.content_outbox_event` 和 `notification_service.notification_outbox_event` 读取最近事件，生成完整 envelope（`eventId/eventName/schemaVersion/aggregateId/dedupeKey/requestId/traceId/payload`），按 `aggregateId` 作为 Kafka key 投递，重复投递后用独立 consumer group 读取并按 `consumerGroup+eventId` 计算去重效果；随后投递一条 `SCHEMA_INVALID` 事件到 DLQ，并对 consumer group offset/lag 做读回。

最近一次通过：

| 证据 | 结果 |
|---|---|
| runId | `b32-kafka-2026082513` |
| Topic | 6/6 存在；本地单 broker、3 分区兼容配置 |
| Outbox source | content 与 notification 各有真实 eventId/aggregateId/dedupeKey |
| duplicate/replay | 两个 source event 均读到重复投递，唯一 eventId 去重后各为 1 |
| DLQ | `SCHEMA_INVALID` 读回 1 条 |
| offset | content/notification/DLQ consumer group lag 均为 0 |
| source mutation | `sourceRowsMutated=false` |

该脚本是本地事件平台证据桥，不冒充生产 publisher/consumer。生产接入仍需独立 workflow worker、ACL、broker 多副本、真实 outbox 状态更新和跨服务消费者；本地 B32 不把单 broker 证据升级成生产可用性结论。

## Redis 投影重建证据

新增注册表项 `learning.srs.projection`：`learning:srs:projection:{userId}:{itemKey}`，事实源为 `mysql.b25_learning_srs_state`，TTL 86400，Redis 不是事实源。

最近一次通过：

| 证据 | 结果 |
|---|---|
| runId | `b32-redis-2026082513` |
| source | 真实 `learning_service.b25_learning_srs_state` |
| first rebuild | PASS |
| duplicate replay | 投影内容稳定，无第二份效果 |
| controlled Redis restart | PONG 恢复，重建后内容一致 |
| TTL | 86400 秒 |
| Redis authority | `sourceOfTruthIsRedis=false` |

## B32 边界

B32 已形成可复核的本机领域数据链和基础设施读回证据，但以下事项仍属于 B33–B36：四端真实 UI 交互、MCP 浏览器完整旅程、异常/重启/乱序回归、全量构建和最终 `LOCAL-TEST-PASS` 交接。不能仅凭本文件宣告 B30–B36 全部完成。
