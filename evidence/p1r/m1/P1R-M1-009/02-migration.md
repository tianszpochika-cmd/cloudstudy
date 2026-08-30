# 迁移边界

本任务没有新增或执行数据库 migration，没有创建 schema/grant、对象桶、KMS key、Kafka topic 或 consumer group。

- B1/B3/B11 旧媒体、录音和跟读入口只增加兼容分类、弃用与 canonical replacement，不删除旧 wire contract。
- recording signed access 收敛到通用 asset signed-access 的 `channel=RECORDING`，不新增第二个幂等例外。
- retention 只引用 M1-017 policyRef/version，不冻结天数，也不把 TTL 当权威保留策略。
- 真实 owner schema、空库/存量库迁移、凭据、对象存储、删除/legal hold 与回滚仍由 M1-017、M2-004 和后续实现任务验收。
