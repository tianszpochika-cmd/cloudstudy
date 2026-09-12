# ADR-0015：事件传输与 Outbox 的标准形状

- 状态：已接受
- 日期：2026-09-13
- 相关任务：`P1R-M2-005`（Kafka transport / Outbox publisher / consumer dedupe / DLQ / replay）、`P1R-M2-006`（workflow Saga / 补偿 / 人工恢复）
- 合约事实源：`config/b26-event-runtime.json`
- 关联决策：[ADR-0010](0010-java25-microservices-gateway-iam.md)（Java 25 微服务与 Gateway/IAM）、[AGENTS.md](../../AGENTS.md) §2.2/§3.2（事件平台与数据所有权）

## 背景

`config/b26-event-runtime.json` 已经把事件运行时**完整规定**为契约：

- broker：Kafka 兼容，固定本地端点 `127.0.0.1:19092`，命名 `platform.<domain>.v1`，默认分区键 `aggregateId`，**至少一次**投递，ACL 默认拒绝且**禁止通配**，**`adminClientInApplication: false`**；
- outbox：`service-owned-mysql`，表名 `<service>_outbox_event`，与聚合同事务、提交后发布、提交后不可变，发布器 `row-lock-skip-locked`、租约 30s、批 100、**broker 确认后才标记已发布**，状态机 `PENDING/PUBLISHING/PUBLISHED/RETRY/DLQ`；
- 消费可靠性：去重必填，唯一键 `(consumerGroup, eventId)`，**效果与去重必须原子**，先落效果后提交 offset，重复效果禁止；重试有界（5 次、指数退避带抖动、1s→60s），可重试/不可重试错误码分明，耗尽即入 DLQ；
- DLQ：`platform.events.dlq.v1`，必须保留原始 `eventId/requestId/traceId/schemaVersion/aggregateId/dedupeKey` 与失败 `consumerGroup/failureCode/attempt/failedAt/recoveryState`，**仅运维可操作**，**不得直接写领域事实**。

`P1R-M2-005` 侦察发现现实与契约的差距是系统性的，而不是零散的：

| 项 | 实测 |
|---|---|
| broker topic | 12 个声明中只有 6 个存在，且既有 6 个是手工创建（3 分区、无 retention/cleanup/minISR）→ 已由 E1 修复 |
| Kafka 依赖 | **任何 pom 都没有** `spring-kafka`/`kafka-clients` |
| outbox 实现 | 仅内存/账本（`InMemoryOutboxStore`、`EventDeliveryLedger`），**没有发布器** |
| outbox 表 | **10 张 `*_outbox_event` 形状各不相同**；全部缺认领与错误字段（`locked_by`/`locked_until`/`published_at`/`last_error_*`）与 `updated_at`；部分缺 `request_id`/`trace_id`/`occurred_at`/`event_name`/`dedupe_key` |
| 列名 | 同一概念三种命名：`event_name` vs `event_type`，`status` vs `state`，`payload_json` vs `payload` |

## 决策

### 1. 标准 outbox 形状（列为权威）

以 `content_service.content_outbox_event` 的完整形状为基线，叠加项目自身 `yuxuexing.outbox_events` 已有的认领/错误字段，得到**唯一**的 outbox 形状：

```
event_id, tenant_id, owner_id, aggregate_type, aggregate_id,
event_name, schema_version, dedupe_key, payload_json,
request_id, trace_id, actor_subject, occurred_at,
status, attempt_count, available_at,
locked_by, locked_until, published_at, last_error_code, last_error_message,
created_at, updated_at
```

要点：
- `(status, available_at)` 建索引，供 `FOR UPDATE SKIP LOCKED` 认领；
- `status` 取值限于契约状态机；
- **不做破坏性重命名**。已有的 `event_type`/`state`/`payload` 保留，由发布器通过**显式列映射**读取；新代码一律写标准列。破坏性重命名会影响既有写入路径，收益不足以抵消风险。

### 2. 传输实现放在服务内，共享的是**契约与形状**而不是运行时代码

每个服务实现自己的发布器与消费者（与 `service-template` 的逐服务复制模型一致），共享的是：
- `config/b26-event-runtime.json`（语义契约）；
- 本 ADR 定义的形状与列映射；
- 由 CI 执行的静态 Gate。

**理由**：AGENTS.md §3.2 要求每个服务拥有自己的 schema、凭据与写权限；发布器要读**本服务**的 outbox 并在**本服务**事务内落去重记录。把它做成共享运行时库会把跨服务的耦合引进来，而收益仅是少写几十行。共享的应该是**语义**，不是进程内代码。

### 3. 去重记录的归属

去重记录由**消费方服务**拥有（契约 `consumer-service-owned-idempotency-record`），唯一键 `(consumer_group, event_id)`，且必须与业务效果在**同一事务**内落库。`analytics_event_journal`/`*_event_receipt` 属这一类，**不是 outbox**，不套用上面的 outbox 形状。

### 4. DLQ 与 replay 由运维/平台负责，不在服务内自建 topic

契约 `adminClientInApplication: false` 与 `dlq.operatorOnly: true` 决定了：topic 由外部脚本供给（`scripts/runtime/provision-kafka-topics.mjs`），DLQ 的消费与回放由平台侧执行；服务只负责**把耗尽重试的事件投递到 DLQ 并保留规定字段**，**不得**自行改写真领域事实。

## 后果

- 正面：形状唯一、语义唯一，发布器与去重记录的实现可在服务间逐字复制而不漂移；契约可被机器校验。
- 代价：需要为 10 张既有 outbox 表补列（非破坏性 ALTER）；列名历史差异需要显式映射。
- 未决：本 ADR 不决定 DLQ 回放的**运维入口**形态，留待 `P1R-M2-006`（workflow-service）。
