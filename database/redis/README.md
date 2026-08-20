# Redis 7 使用约定

机器可读的唯一注册表是 [`keyspace.registry.json`](./keyspace.registry.json)。它描述短期会话、断点、锁、限流、去重、房间/座位/榜单投影、权益与 Feature Flag 快照。校验入口是 [`scripts/database/validate-redis-keyspace.mjs`](../../scripts/database/validate-redis-keyspace.mjs)，运行：

```text
node scripts/database/validate-redis-keyspace.mjs
```

## 语义边界

- Redis 7 只保存短状态、互斥辅助和可重建投影；MySQL、追加式事件表或 durable outbox 才是事实源。Redis 丢失不能导致订单、支付、审核、SRS、学习事件、奖励或审计事实丢失。
- 所有注册 key 都必须有 TTL，并遵守 `volatile-ttl` 类淘汰约束。缓存被淘汰后按 `sourceOfTruth` 重建；安全路径、权益、风控、写副作用和座位租约默认 fail-closed，普通只读页面可以降级为 stale/loading。
- key 参数只能使用稳定 ID、版本、日期、窗口或 HMAC/SHA-256 摘要。禁止手机号、邮箱、IP、设备指纹、Refresh/Access token、验证码、API key、原始音频和支付原文进入 key、value、日志或 fixture。
- `learning:context:{userId}` 保留 7 天；OTP 5 分钟；Access deny jti 不超过 Access 剩余寿命（上限 2 小时）；座位租约 90 秒、约 30 秒续租；写幂等短响应 24 小时。未在设计中指定的只读投影采用注册表中的短 TTL，并明确可重建与 fail mode。

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

合成样例位于 [`tests/fixtures/redis-keyspace.fixture.json`](../../tests/fixtures/redis-keyspace.fixture.json)，仅包含测试 ID、哈希和演示版本，不包含真实手机号、邮箱、token、API key 或音频。
