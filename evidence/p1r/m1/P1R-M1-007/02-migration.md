# 迁移与数据影响

本任务没有新增 MySQL DDL、Flyway migration、Redis key、Kafka topic/ACL 或生产数据迁移。策略中的 Outbox、dedupe、Saga、recovery 和 receipt 均为 D2 结构与状态机，不是已部署表或运行记录。

数据边界继续以 owner-local 写入为准：workflow-service 只协调，audit-service 只拥有审计事实，二者均不得跨服务写领域表。`P1R-M2-004` 仍负责真实 schema/grant、迁移、TenantScope、Redis 与恢复验证；`P1R-M2-005/006` 分别负责事件可靠性和 Saga/恢复运行落地。

因此本任务只需 Git/契约回滚，不需要反向数据库迁移或 broker 清理。
