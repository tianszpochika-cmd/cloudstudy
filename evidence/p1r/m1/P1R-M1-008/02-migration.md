# 迁移边界

本任务没有新增或执行数据库 migration，也没有创建 schema、grant、Outbox 表、Kafka topic 或 consumer group。

- B1 的 8 个旧内容写操作仅增加结构化弃用和 canonical B9 replacement；未伪造退役日期。
- 旧 `archive` 外部写语义映射为 `UNPUBLISH`；`ARCHIVED` 只由 content-service 内部 retirement policy 产生，不新增第二套外部状态机。
- canonical contract、生成物和历史兼容比较已更新；真实 owner schema、权限、空库/存量库迁移和回滚仍由 `P1R-M2-004` 验收。
- 任何未来 wire tightening 或数据迁移必须重新走 compatibility、owner migration 与 rollback Evidence，不能继承本 D2 静态结论。
