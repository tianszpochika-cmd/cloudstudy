# 迁移与数据影响

本任务没有数据库 DDL、Flyway migration 或生产数据迁移，也没有创建 Kafka topic 或 ACL。

`config/b26-event-runtime.json` 只是失败关闭的静态候选输入：6 个 topic policy 与 7 条 workflow event route 必须精确匹配 owner、producer principal、consumer groups、ACL 和 partition policy。它保持 `runtimeStatus=pending`、`runtimeGate=static-only`、`defaultDecision=NO-GO`，不能作为运行迁移证据。

因此本任务的回滚是代码和契约回滚，不涉及反向数据库迁移。真实 Kafka 基础设施迁移归 `P1R-M2-005`。
