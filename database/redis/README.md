# Redis 7 使用约定

单个 key 的模板、TTL 和 source-of-truth 语义以 [`keyspace.registry.json`](./keyspace.registry.json) 为机器可读注册表。P1R-M1-005 的目标数据 owner、schema 和 namespace 则以 [`config/p1r-data-ownership.v1.json`](../../config/p1r-data-ownership.v1.json) 为机器可读事实源；现有 registry 中的历史 owner 不能覆盖该目标政策。注册表描述短期会话、断点、锁、限流、去重、房间/座位/榜单投影、权益与 Feature Flag 快照。校验入口是 [`scripts/database/validate-redis-keyspace.mjs`](../../scripts/database/validate-redis-keyspace.mjs)，运行：

```text
node scripts/database/validate-redis-keyspace.mjs
```

## 语义边界

- Redis 7 只保存短状态、互斥辅助和可重建投影；MySQL、追加式事件表或 durable outbox 才是事实源。Redis 丢失不能导致订单、支付、审核、SRS、学习事件、奖励或审计事实丢失。
- 所有注册 key 都必须有 TTL，并遵守 `volatile-ttl` 类淘汰约束。缓存被淘汰后按 `sourceOfTruth` 重建；安全路径、权益、风控、写副作用和座位租约默认 fail-closed，普通只读页面可以降级为 stale/loading。
- key 参数只能使用稳定 ID、版本、日期、窗口或 HMAC/SHA-256 摘要。禁止手机号、邮箱、IP、设备指纹、Refresh/Access token、验证码、API key、原始音频和支付原文进入 key、value、日志或 fixture。
- `learning:context:{userId}` 保留 7 天；OTP 5 分钟；Access deny jti 不超过 Access 剩余寿命（上限 2 小时）；座位租约 90 秒、约 30 秒续租；写幂等短响应 24 小时。未在设计中指定的只读投影采用注册表中的短 TTL，并明确可重建与 fail mode。

## P1R-M1-005 D2 namespace owner 与迁移输入

以下是 D2 目标 namespace 分配。`api-gateway` 没有业务 schema 或领域写 authority；其 `gateway` namespace 只允许边界短状态。其余 14 个服务是数据 owner，必须各自使用独立 runtime Redis credential/ACL 和独立 namespace；该项目前仍是 `P1R-M2-004` 的运行验证责任，以下映射不是 ACL 或重建已经通过的证明。

| 服务 | 目标业务 schema | Redis namespace | D2 状态 |
|---|---|---|---|
| `api-gateway` | 不适用；无业务 schema/写 authority | `gateway` | 边界短状态，不得成为业务事实 |
| `iam-service` | `iam_service` | `iam` | 现有候选，运行验证待 M2-004 |
| `audit-service` | `audit_service` | `audit` | `PLANNED_M2_004` |
| `workflow-service` | `workflow_service` | `workflow` | `PLANNED_M2_004` |
| `learner-service` | `learner_service` | `learner` | 现有候选，运行验证待 M2-004 |
| `content-service` | `content_service` | `content` | 现有候选，运行验证待 M2-004 |
| `learning-service` | `learning_service` | `learning` | 现有候选，运行验证待 M2-004 |
| `assessment-service` | `assessment_service` | `assessment` | 现有候选，运行验证待 M2-004 |
| `media-service` | `media_service` | `media` | 现有候选，运行验证待 M2-004 |
| `gamification-service` | `gamification_service` | `gamification` | 现有候选，运行验证待 M2-004 |
| `social-service` | `social_service` | `social` | 现有候选，运行验证待 M2-004 |
| `commerce-service` | `commerce_service` | `commerce` | 现有候选，运行验证待 M2-004 |
| `notification-service` | `notification_service` | `notification` | 现有候选，运行验证待 M2-004 |
| `analytics-service` | `analytics_service` | `analytics` | 现有候选，运行验证待 M2-004 |
| `admin-ops-service` | `admin_ops_service` | `admin-ops` | 现有候选，运行验证待 M2-004 |

`config/b25-data.json` 的 8-owner map（`workflow-service`、`learner-service`、`content-service`、`learning-service`、`assessment-service`、`media-service`、`commerce-service`、`notification-service`）是 `HISTORICAL_CANDIDATE_MIGRATION_INPUT`，不是当前完整 owner 矩阵、Redis ACL 或 schema grant 的证据。

`keyspace.registry.json` 中所有 `core-api.*` owner 也都是 historical-candidate/migration input，迁移责任均为 `P1R-M2-004`：

| 历史 registry owner | 目标迁移 owner / 规则 |
|---|---|
| `core-api.auth` | `iam-service` |
| `core-api.learning` | `learning-service` |
| `core-api.assessment` | `assessment-service` |
| `core-api.social` | `social-service` |
| `core-api.commerce` | `commerce-service` |
| `core-api.ops`、`core-api.risk` | `admin-ops-service` |
| `core-api.common` | 按 route-owning domain 拆分幂等状态；禁止形成共享 namespace |
| `core-api.event-consumer` | 归 consumer-owning domain；去重状态必须有持久 owner 事实 |
| `core-api.sync` | 归每个 domain stream owner；禁止形成共享 sync data owner |

历史标签不能证明目标 namespace、Redis ACL、重建路径或任何业务 source of truth；新实现不得继续向 `core-api.*` namespace 增加业务状态。

## 原子操作与锁

- 互斥使用 `SET key owner NX PX`，释放必须用 Lua 比较 owner 后删除；续租必须同时比较 leaseId/leaseVersion。禁止无条件 `DEL`，避免旧 worker 删除新租约。
- 计数限流使用 `INCR` 与首次写入时的 `EXPIRE/EXPIREAT` 原子策略；OTP 核验/一次性消费使用 Lua 或 `GETDEL` 组合，成功只能核销一次。
- 去重/幂等使用 `SET NX` 作为快速路径，但必须同时依赖 MySQL 唯一键或持久幂等记录。相同 key、相同 body hash 返回首次响应；body hash 不同返回稳定的 key-reuse 错误，不能覆盖原响应。
- Redis 锁只降低热点竞争：SRS 仍按“状态行→快照项”顺序使用 MySQL 行锁；模考仍由数据库唯一键、session 状态机和服务端 deadline 保证；房间入座同时依赖 Lua 多 key 原子检查与 MySQL 唯一约束。
- Redis Stream 只保留短增量窗口；`lastSeenSeq` 超窗、roomVersion 不一致或 Stream 被淘汰时，必须发送完整房间快照。ZSET 榜单只做实时投影，周一 02:00（Asia/Shanghai）结算为不可变持久快照。

## Redis 丢失后的重建原则

1. 先区分读路径与副作用路径：普通查询重建或显示 stale；写入、发奖、支付权益、风险放行、发 OTP、座位新租约和互动在事实无法确认时拒绝或稍后重试。
2. 从注册表的 `sourceOfTruth` 重放 MySQL 投影或 durable event/outbox；不能从客户端状态、Redis 旧值或缓存命中结果推断事实。
3. 重建使用版本/时间戳单调比较，不能以较旧断点、较旧 cursor、较旧 lease 或较旧 flag 覆盖新状态；重建完成后再设置 TTL。
4. 房间使用当前成员/座位事实生成快照；榜单从已过滤、去重、合并重叠区间的学习事实重算；Feature Flag 缺失默认关闭；权益/风险缺失默认不放行受保护能力。
5. 监控 keyspace misses、eviction、expired、lock contention、dedupe fallback、rebuild latency，并将 durable fallback 作为正常可回放路径，而不是静默伪造空数据。

以上是 D2 设计约束，不能替代 Redis 7 的 ACL、丢失/重启读回、投影重建或安全降级的运行演练。它们与 owner grant、空库/存量库迁移、`TenantScope` 跨租户拒绝和 runtime rollback/compensation 一并由 `P1R-M2-004` 保持 OPEN 并验收。

合成样例位于 [`tests/fixtures/redis-keyspace.fixture.json`](../../tests/fixtures/redis-keyspace.fixture.json)，仅包含测试 ID、哈希和演示版本，不包含真实手机号、邮箱、token、API key 或音频。
