# 迁移与兼容证据

- M1-015 canonical OpenAPI 来自升级后的 B13 M1015 子图；B5/B13 v1 route/event/Java/migration 只保留 historical adapter/candidate 语义。
- source-bound compatibility 固定来源基线 `5d0bb3a0651d9205a942eca9d8e1c56b538ed73f`、历史 CI 基线 `463c4b238caceb1592bff6c61327c00ab9bac922` 与 immutable governance `868c2177f62b6d2cf613bed702686dddcfe6943f`。
- 两条固定 Git compatibility 均报告 OpenAPI/events/schema compatible，`breakingChanges=[]`；Gateway 只精确增加两条 commerce internal workload operation，并把 internal baseline count 从 51 调整到 53。
- 本任务没有创建真实 MySQL/Flyway/grant，也没有迁移生产 provider、订单或权益数据。真实 owner schema、权限、空库/存量迁移与回滚仍归 M2/M7。
